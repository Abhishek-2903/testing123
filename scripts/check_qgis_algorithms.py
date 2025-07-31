# Script to check available QGIS algorithms
import subprocess

def check_qgis_algorithms():
    try:
        # List all available algorithms
        result = subprocess.run([
            r"C:\Program Files\QGIS 3.42.3\bin\qgis_process-qgis.bat",
            "list"
        ], capture_output=True, text=True, timeout=60)
        
        print("Available algorithms:")
        print(result.stdout)
        
        # Filter for tile-related algorithms
        lines = result.stdout.split('\n')
        tile_algorithms = [line for line in lines if 'tile' in line.lower() or 'qtiles' in line.lower()]
        
        print("\nTile-related algorithms:")
        for alg in tile_algorithms:
            print(alg)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_qgis_algorithms()
