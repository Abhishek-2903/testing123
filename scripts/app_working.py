from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import os
import json
import time
import tempfile
import requests
from urllib.parse import urlparse
import sqlite3
import math
import re
import threading
from collections import defaultdict

app = Flask(__name__)
CORS(app)

# QGIS installation path - adjust if needed
QGIS_PATH = r"C:\Program Files\QGIS 3.42.3\bin\qgis_process-qgis.bat"

# Global progress tracking with enhanced fields
progress_data = defaultdict(lambda: {
    'total_tiles': 0,
    'downloaded_tiles': 0,
    'current_zoom': 0,
    'status': 'idle',
    'error': None,
    'start_time': 0,
    'output_file': None,
    'display_name': None,
    'file_size_bytes': 0,
    'method': 'manual',
    'last_update': 0,
    'tiles_per_zoom': {}
})

def deg2num(lat_deg, lon_deg, zoom):
    """Convert lat/lon to tile numbers"""
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

def num2deg(xtile, ytile, zoom):
    """Convert tile numbers to lat/lon"""
    n = 2.0 ** zoom
    lon_deg = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
    lat_deg = math.degrees(lat_rad)
    return (lat_deg, lon_deg)

def calculate_total_tiles(min_lat, max_lat, min_lon, max_lon, min_zoom, max_zoom):
    """Calculate total number of tiles needed"""
    total = 0
    tiles_per_zoom = {}
    
    for zoom in range(min_zoom, max_zoom + 1):
        min_x, max_y = deg2num(min_lat, min_lon, zoom)
        max_x, min_y = deg2num(max_lat, max_lon, zoom)
        tiles_this_zoom = (max_x - min_x + 1) * (max_y - min_y + 1)
        total += tiles_this_zoom
        tiles_per_zoom[zoom] = tiles_this_zoom
        
    return total, tiles_per_zoom

def create_mbtiles_manually(lat, lon, min_zoom=10, max_zoom=16, buffer=0.005, custom_filename=None, session_id=None):
    """Create MBTiles file by downloading tiles manually"""
    
    try:
        # Calculate bounding box
        min_lat = lat - buffer
        max_lat = lat + buffer
        min_lon = lon - buffer
        max_lon = lon + buffer
        
        # Initialize progress tracking
        if session_id:
            total_tiles, tiles_per_zoom = calculate_total_tiles(min_lat, max_lat, min_lon, max_lon, min_zoom, max_zoom)
            progress_data[session_id].update({
                'total_tiles': total_tiles,
                'downloaded_tiles': 0,
                'current_zoom': min_zoom,
                'status': 'downloading',
                'error': None,
                'start_time': time.time(),
                'last_update': time.time(),
                'tiles_per_zoom': tiles_per_zoom,
                'method': 'manual'
            })
            print(f"Session {session_id}: Starting download of {total_tiles} tiles")
        
        # Create output filename
        if custom_filename:
            # Sanitize custom filename
            safe_filename = re.sub(r'[^a-zA-Z0-9_-]', '_', custom_filename)
            safe_filename = re.sub(r'_+', '_', safe_filename).strip('_')
            output_file = f"{safe_filename}.mbtiles"
        else:
            output_file = f"output_{int(time.time())}.mbtiles"
        
        # Create SQLite database for MBTiles
        conn = sqlite3.connect(output_file)
        cursor = conn.cursor()
        
        # Create MBTiles schema
        cursor.execute('''
            CREATE TABLE metadata (name text, value text);
        ''')
        cursor.execute('''
            CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);
        ''')
        cursor.execute('''
            CREATE UNIQUE INDEX tile_index on tiles (zoom_level, tile_column, tile_row);
        ''')
        
        # Insert metadata
        metadata = [
            ('name', 'Satellite Imagery'),
            ('type', 'baselayer'),
            ('version', '1.0'),
            ('description', 'Satellite imagery tiles'),
            ('format', 'png'),
            ('bounds', f'{min_lon},{min_lat},{max_lon},{max_lat}'),
            ('minzoom', str(min_zoom)),
            ('maxzoom', str(max_zoom)),
            ('center', f'{lon},{lat},{min_zoom}'),
            ('attribution', 'Satellite imagery © ArcGIS World Imagery')
        ]
        
        cursor.executemany('INSERT INTO metadata (name, value) VALUES (?, ?)', metadata)
        
        tile_count = 0
        successful_tiles = 0
        failed_tiles = 0
        
        # Download tiles for each zoom level
        for zoom in range(min_zoom, max_zoom + 1):
            if session_id:
                progress_data[session_id]['current_zoom'] = zoom
                progress_data[session_id]['last_update'] = time.time()
                
            print(f"Processing zoom level {zoom}...")
            
            # Calculate tile bounds for this zoom level
            min_x, max_y = deg2num(min_lat, min_lon, zoom)
            max_x, min_y = deg2num(max_lat, max_lon, zoom)
            
            zoom_start_tiles = tile_count
            zoom_successful = 0
            
            # Download tiles
            for x in range(min_x, max_x + 1):
                for y in range(min_y, max_y + 1):
                    try:
                        # ArcGIS World Imagery URL
                        tile_url = f"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{y}/{x}"
                        
                        # Download tile with retry logic
                        response = requests.get(tile_url, timeout=15, 
                                              headers={'User-Agent': 'MBTiles-Downloader/1.0'})
                        
                        if response.status_code == 200 and len(response.content) > 0:
                            tile_data = response.content
                            
                            # Verify it's actually image data (basic check)
                            if tile_data.startswith(b'\x89PNG') or tile_data.startswith(b'\xff\xd8\xff'):
                                # Convert Y coordinate to TMS format (flip Y axis)
                                tms_y = (2**zoom - 1) - y
                                
                                # Insert tile into database
                                cursor.execute(
                                    'INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)',
                                    (zoom, x, tms_y, tile_data)
                                )
                                successful_tiles += 1
                                zoom_successful += 1
                            else:
                                print(f"Invalid image data for tile {zoom}/{x}/{y}")
                                failed_tiles += 1
                        else:
                            print(f"Failed to download tile {zoom}/{x}/{y}: HTTP {response.status_code}")
                            failed_tiles += 1
                            
                        tile_count += 1
                        
                        # Update progress more frequently (every 3 tiles instead of 5)
                        if session_id:
                            progress_data[session_id]['downloaded_tiles'] = tile_count
                            progress_data[session_id]['last_update'] = time.time()
                        
                        if tile_count % 3 == 0:
                            print(f"Processed {tile_count} tiles ({successful_tiles} successful, {failed_tiles} failed)...")
                            
                        # Small delay to be respectful to the tile server
                        time.sleep(0.05)  # 50ms delay
                                
                    except Exception as e:
                        print(f"Failed to download tile {zoom}/{x}/{y}: {e}")
                        failed_tiles += 1
                        tile_count += 1
                        if session_id:
                            progress_data[session_id]['downloaded_tiles'] = tile_count
                        continue
            
            conn.commit()
            print(f"Completed zoom level {zoom}: {zoom_successful} successful tiles out of {tile_count - zoom_start_tiles} attempted")
            
        conn.close()
        
        if successful_tiles == 0:
            if session_id:
                progress_data[session_id]['status'] = 'error'
                progress_data[session_id]['error'] = 'No tiles were successfully downloaded'
            if os.path.exists(output_file):
                os.remove(output_file)
            return None, "No tiles were successfully downloaded"
        
        if session_id:
            progress_data[session_id]['status'] = 'completed'
            progress_data[session_id]['last_update'] = time.time()
        
        print(f"Successfully created MBTiles with {successful_tiles} tiles (attempted: {tile_count}, failed: {failed_tiles})")
        return output_file, None
        
    except Exception as e:
        print(f"Error during tile download: {e}")
        if session_id:
            progress_data[session_id]['status'] = 'error'
            progress_data[session_id]['error'] = str(e)
            progress_data[session_id]['last_update'] = time.time()
        if 'conn' in locals():
            conn.close()
        if 'output_file' in locals() and os.path.exists(output_file):
            os.remove(output_file)
        return None, str(e)

def create_qgis_project_and_tiles(lat, lon, min_zoom=10, max_zoom=16, buffer=0.005, custom_filename=None):
    """Create a temporary QGIS project and generate tiles"""
    
    try:
        # Calculate bounding box
        min_lat = lat - buffer
        max_lat = lat + buffer
        min_lon = lon - buffer
        max_lon = lon + buffer
        
        # Create temporary project file
        project_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<qgis version="3.42.3" projectname="">
  <mapcanvas>
    <extent>
      <xmin>{min_lon}</xmin>
      <ymin>{min_lat}</ymin>
      <xmax>{max_lon}</xmax>
      <ymax>{max_lat}</ymax>
    </extent>
  </mapcanvas>
  <projectCrs>
    <spatialrefsys>
      <wkt>GEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["geodetic latitude (Lat)",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["geodetic longitude (Lon)",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],USAGE[SCOPE["Horizontal component of 3D system."],AREA["World."],BBOX[-90,-180,90,180]],ID["EPSG",4326]]</wkt>
      <proj4>+proj=longlat +datum=WGS84 +no_defs</proj4>
      <srsid>3452</srsid>
      <srid>4326</srid>
      <authid>EPSG:4326</authid>
      <description>WGS 84</description>
    </spatialrefsys>
  </projectCrs>
</qgis>'''
        
        # Create temporary files
        with tempfile.NamedTemporaryFile(mode='w', suffix='.qgz', delete=False) as temp_project:
            temp_project.write(project_content)
            project_path = temp_project.name
        
        if custom_filename:
            # Sanitize custom filename
            safe_filename = re.sub(r'[^a-zA-Z0-9_-]', '_', custom_filename)
            safe_filename = re.sub(r'_+', '_', safe_filename).strip('_')
            output_file = f"{safe_filename}.mbtiles"
        else:
            output_file = f"output_{int(time.time())}.mbtiles"
        
        # Try to create tiles using QGIS with project
        cmd = [
            QGIS_PATH,
            "run", "native:tilesxyzmbtiles",
            f"--project-path={project_path}",
            f"--EXTENT={min_lon},{min_lat},{max_lon},{max_lat}",
            f"--ZOOM_MIN={min_zoom}",
            f"--ZOOM_MAX={max_zoom}",
            "--DPI=96",
            "--TILE_FORMAT=0",  # PNG
            f"--OUTPUT_FILE={output_file}",
            "--TILE_WIDTH=256",
            "--TILE_HEIGHT=256",
            "--TMS_CONVENTION=false"
        ]
        
        print(f"Running QGIS command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0 and os.path.exists(output_file):
            return output_file, None
        else:
            print(f"QGIS failed: {result.stderr}")
            return None, result.stderr
            
    except Exception as e:
        print(f"QGIS method failed: {e}")
        return None, str(e)
    finally:
        # Clean up temporary project file
        try:
            if 'project_path' in locals():
                os.unlink(project_path)
        except:
            pass

@app.route('/check_qgis', methods=['GET'])
def check_qgis():
    """Endpoint to check QGIS installation and available algorithms"""
    if not os.path.exists(QGIS_PATH):
        return jsonify({
            "error": f"QGIS not found at {QGIS_PATH}",
            "qgis_status": "QGIS not found",
            "manual_method_available": True,
            "tile_algorithms": []
        }), 200  # Return 200 instead of 500 so frontend doesn't show error
    
    try:
        result = subprocess.run([QGIS_PATH, "list"], 
                              capture_output=True, text=True, timeout=30)
        algorithms = result.stdout
        
        # Look for tile-related algorithms
        lines = algorithms.split('\n')
        tile_algorithms = [line.strip() for line in lines if 'tile' in line.lower()]
        
        return jsonify({
            "qgis_status": "QGIS found and working",
            "tile_algorithms": tile_algorithms[:10],  # First 10 tile algorithms
            "manual_method_available": True,
            "total_algorithms": len(lines)
        })
    except Exception as e:
        return jsonify({
            "error": f"Error checking QGIS: {e}",
            "qgis_status": "QGIS found but not working",
            "manual_method_available": True,
            "tile_algorithms": []
        }), 200

@app.route('/progress/<session_id>', methods=['GET'])
def get_progress(session_id):
    """Get download progress for a session"""
    if session_id not in progress_data:
        return jsonify({"error": "Session not found"}), 404
    
    data = progress_data[session_id].copy()
    
    # Calculate additional metrics
    if data['total_tiles'] > 0:
        data['progress_percent'] = round((data['downloaded_tiles'] / data['total_tiles']) * 100, 1)
    else:
        data['progress_percent'] = 0
    
    if data['start_time'] > 0 and data['downloaded_tiles'] > 0:
        elapsed_time = time.time() - data['start_time']
        tiles_per_second = data['downloaded_tiles'] / elapsed_time
        
        if tiles_per_second > 0:
            remaining_tiles = data['total_tiles'] - data['downloaded_tiles']
            estimated_remaining_seconds = remaining_tiles / tiles_per_second
            data['estimated_remaining_time'] = round(estimated_remaining_seconds)
        else:
            data['estimated_remaining_time'] = 0
        
        data['elapsed_time'] = round(elapsed_time)
        data['tiles_per_second'] = round(tiles_per_second, 1)
    else:
        data['estimated_remaining_time'] = 0
        data['elapsed_time'] = 0
        data['tiles_per_second'] = 0
    
    # Add session health check
    data['last_update_ago'] = round(time.time() - data.get('last_update', 0))
    
    return jsonify(data)

@app.route('/download_mbtiles', methods=['POST'])
def download_mbtiles():
    try:
        data = request.json
        lat = float(data.get("lat"))
        lon = float(data.get("lon"))
        buffer = float(data.get("buffer", 0.005))
        min_zoom = int(data.get("min_zoom", 10))
        max_zoom = int(data.get("max_zoom", 22))
        custom_filename = data.get("filename", "").strip()
        
        # Generate unique session ID
        session_id = f"session_{int(time.time())}_{hash(f'{lat}_{lon}_{buffer}') % 10000}"

        # Validate coordinates
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return jsonify({"error": "Invalid coordinates"}), 400
        
        # Validate zoom levels
        if not (1 <= min_zoom <= 21) or not (1 <= max_zoom <= 21) or min_zoom > max_zoom:
            return jsonify({"error": "Invalid zoom levels"}), 400
        
        # Validate buffer
        if not (0.001 <= buffer <= 0.1):
            return jsonify({"error": "Buffer must be between 0.001 and 0.1 degrees"}), 400

        print(f"Creating MBTiles for coordinates: {lat}, {lon}")
        print(f"Buffer: {buffer}, Zoom: {min_zoom}-{max_zoom}")
        print(f"Session ID: {session_id}")

        # Estimate total tiles for user info
        total_tiles_estimate, _ = calculate_total_tiles(
            lat - buffer, lat + buffer, lon - buffer, lon + buffer, min_zoom, max_zoom
        )
        print(f"Estimated total tiles: {total_tiles_estimate}")

        # Start download in background thread
        def background_download():
            try:
                # Use manual method with progress tracking
                output_file, error = create_mbtiles_manually(lat, lon, min_zoom, max_zoom, buffer, custom_filename, session_id)
                
                if output_file and os.path.exists(output_file):
                    file_size = os.path.getsize(output_file)
                    display_name = custom_filename + ".mbtiles" if custom_filename else output_file
                    progress_data[session_id].update({
                        'status': 'completed',
                        'output_file': output_file,
                        'display_name': display_name,
                        'file_size_bytes': file_size,
                        'last_update': time.time()
                    })
                    print(f"Session {session_id}: Download completed successfully")
                else:
                    progress_data[session_id].update({
                        'status': 'error',
                        'error': error or 'Unknown error occurred',
                        'last_update': time.time()
                    })
                    print(f"Session {session_id}: Download failed - {error}")
                    
            except Exception as e:
                progress_data[session_id].update({
                    'status': 'error',
                    'error': str(e),
                    'last_update': time.time()
                })
                print(f"Session {session_id}: Exception occurred - {e}")
        
        # Start background thread
        thread = threading.Thread(target=background_download)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            "status": "Download started",
            "session_id": session_id,
            "message": "Use the session ID to track progress",
            "estimated_tiles": total_tiles_estimate,
            "coordinates": {"lat": lat, "lon": lon},
            "zoom_range": {"min": min_zoom, "max": max_zoom}
        }), 202

    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/download_file/<filename>', methods=['GET'])
def download_file(filename):
    """Download the generated MBTiles file"""
    try:
        if os.path.exists(filename) and filename.endswith('.mbtiles'):
            return send_file(filename, as_attachment=True, download_name=filename)
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/cleanup_session/<session_id>', methods=['POST'])
def cleanup_session(session_id):
    """Clean up session data and files"""
    try:
        if session_id in progress_data:
            # Get the output file if it exists
            output_file = progress_data[session_id].get('output_file')
            
            # Remove from progress tracking
            del progress_data[session_id]
            
            # Optionally clean up the file (uncomment if desired)
            # if output_file and os.path.exists(output_file):
            #     os.remove(output_file)
            
            return jsonify({"status": "Session cleaned up successfully"})
        else:
            return jsonify({"error": "Session not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": time.time(),
        "active_sessions": len(progress_data),
        "version": "1.0"
    })

if __name__ == "__main__":
    print("Starting Enhanced MBTiles Flask app...")
    print("Features:")
    print("  ✓ Real-time progress tracking")
    print("  ✓ Enhanced error handling")
    print("  ✓ Session management")
    print("  ✓ Tile validation")
    print("  ✓ Respectful tile downloading")
    
    # Check if requests library is available
    try:
        import requests
        print("  ✓ Requests library available for manual tile download")
    except ImportError:
        print("  ⚠ Requests library not available. Install with: pip install requests")
    
    # Check QGIS availability
    if os.path.exists(QGIS_PATH):
        print(f"  ✓ QGIS found at {QGIS_PATH}")
    else:
        print(f"  ⚠ QGIS not found at {QGIS_PATH} (manual download still available)")
    
    print("\nStarting server on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
