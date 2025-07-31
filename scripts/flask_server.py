#!/usr/bin/env python3
"""
Flask Backend Server for Shoonya Innovation MBTiles Application
Provides API endpoints for MBTiles download and management
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import tempfile
import threading
from mbtiles_downloader import MBTilesDownloader

app = Flask(__name__)
CORS(app)

# Global variables for tracking downloads
active_downloads = {}
download_results = {}

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Shoonya Innovation MBTiles Server',
        'version': '1.0.0'
    })

@app.route('/api/download-mbtiles', methods=['POST'])
def download_mbtiles():
    """Start MBTiles download process"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['bounds', 'minZoom', 'maxZoom', 'tileSource', 'outputName']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Validate bounds
        bounds = data['bounds']
        required_bounds = ['north', 'south', 'east', 'west']
        for bound in required_bounds:
            if bound not in bounds:
                return jsonify({'error': f'Missing bound: {bound}'}), 400
        
        # Validate zoom levels
        min_zoom = data['minZoom']
        max_zoom = data['maxZoom']
        
        if min_zoom < 0 or max_zoom > 18 or min_zoom > max_zoom:
            return jsonify({'error': 'Invalid zoom levels'}), 400
        
        # Generate unique download ID
        download_id = f"{data['outputName']}_{int(time.time())}"
        
        # Start download in background thread
        def background_download():
            try:
                downloader = MBTilesDownloader()
                result = downloader.download_tiles(
                    bounds=bounds,
                    min_zoom=min_zoom,
                    max_zoom=max_zoom,
                    tile_source=data['tileSource'],
                    output_name=data['outputName']
                )
                download_results[download_id] = result
                if download_id in active_downloads:
                    del active_downloads[download_id]
            except Exception as e:
                download_results[download_id] = {
                    'success': False,
                    'error': str(e)
                }
                if download_id in active_downloads:
                    del active_downloads[download_id]
        
        # Mark as active download
        active_downloads[download_id] = {
            'status': 'downloading',
            'started_at': time.time()
        }
        
        # Start background thread
        thread = threading.Thread(target=background_download)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'download_id': download_id,
            'message': 'Download started',
            'status': 'downloading'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download-status/<download_id>', methods=['GET'])
def download_status(download_id):
    """Check download status"""
    try:
        if download_id in active_downloads:
            return jsonify({
                'status': 'downloading',
                'download_id': download_id
            })
        elif download_id in download_results:
            result = download_results[download_id]
            if result['success']:
                return jsonify({
                    'status': 'completed',
                    'download_id': download_id,
                    'result': result
                })
            else:
                return jsonify({
                    'status': 'failed',
                    'download_id': download_id,
                    'error': result.get('error', 'Unknown error')
                })
        else:
            return jsonify({'error': 'Download not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download-file/<filename>', methods=['GET'])
def download_file(filename):
    """Download the generated MBTiles file"""
    try:
        if not filename.endswith('.mbtiles'):
            filename += '.mbtiles'
        
        if os.path.exists(filename):
            return send_file(
                filename,
                as_attachment=True,
                download_name=filename,
                mimetype='application/octet-stream'
            )
        else:
            return jsonify({'error': 'File not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tile-sources', methods=['GET'])
def get_tile_sources():
    """Get available tile sources"""
    downloader = MBTilesDownloader()
    return jsonify({
        'sources': list(downloader.tile_sources.keys()),
        'descriptions': {
            'openstreetmap': 'Open Street Map - Free and open source',
            'satellite': 'Satellite imagery - High resolution',
            'terrain': 'Terrain map - Topographical features'
        }
    })

if __name__ == '__main__':
    import time
    print("Starting Shoonya Innovation MBTiles Server...")
    print("Server will be available at http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
