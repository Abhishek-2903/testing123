# Shoonya Innovation - Advanced MBTiles Satellite Exporter

A professional-grade application for downloading high-quality satellite imagery tiles with real-time progress tracking and advanced features.

## 🚀 Features

- **Real-time Progress Tracking**: Live updates with detailed statistics
- **Satellite Imagery**: High-quality ArcGIS World Imagery tiles
- **QGIS Integration**: Fallback support for QGIS processing
- **Session Management**: Track multiple downloads simultaneously
- **Advanced UI**: Modern, responsive interface with Shoonya branding
- **Connection Monitoring**: Automatic backend health checks
- **File Management**: Custom naming and automatic downloads

## 📋 Prerequisites

- **Python 3.8+** with pip
- **Node.js 18+** and npm
- **QGIS 3.42.3** (optional, for advanced processing)
- Modern web browser

## 🛠️ Installation

### 1. Install Python Dependencies
\`\`\`bash
pip install flask flask-cors requests
\`\`\`

### 2. Install Node.js Dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Start the Backend Server
\`
\`\`\`

### 2. Install Node.js Dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Start the Backend Server
\`\`\`bash
cd scripts
python app_working.py
\`\`\`

### 4. Start the Frontend
\`\`\`bash
npm run dev
\`\`\`

### 5. Access the Application
Open http://localhost:3000 in your browser

## 🎯 Usage

### Basic Workflow
1. **Enter Coordinates**: Input latitude and longitude for your area of interest
2. **Configure Settings**: Set area size, zoom levels, and optional filename
3. **Check Setup**: Verify system status and available methods
4. **Download**: Start the MBTiles download with real-time progress tracking
5. **Monitor Progress**: Watch detailed statistics and download speed
6. **Download File**: Get your completed MBTiles file

### Quick Start Examples
- **New York City**: Lat: 40.7128, Lon: -74.0060
- **London**: Lat: 51.5074, Lon: -0.1278
- **Tokyo**: Lat: 35.6762, Lon: 139.6503

### Zoom Level Guidelines
- **1-8**: Country/Region level (low detail, small files)
- **9-12**: City level (medium detail)
- **13-16**: Street/Building level (recommended for most uses)
- **17-21**: Very detailed (large file sizes, long download times)

## 🔧 Configuration

### Backend Configuration
The Python backend runs on `http://127.0.0.1:5000` by default. Key settings in `app_working.py`:

- **QGIS_PATH**: Path to QGIS installation
- **Tile Source**: ArcGIS World Imagery (high-quality satellite)
- **Rate Limiting**: 50ms delay between tile requests
- **Session Management**: Automatic progress tracking

### Frontend Configuration
The Next.js frontend connects to the backend automatically. Key features:

- **Real-time Updates**: Progress polling every 1.5 seconds
- **Connection Monitoring**: Automatic health checks every 30 seconds
- **Responsive Design**: Works on desktop and mobile devices

## 📊 API Endpoints

### Health Check
\`\`\`
GET /health
\`\`\`

### Check QGIS Setup
\`\`\`
GET /check_qgis
\`\`\`

### Start Download
\`\`\`
POST /download_mbtiles
Content-Type: application/json

{
  "lat": 40.7128,
  "lon": -74.0060,
  "buffer": 0.005,
  "min_zoom": 10,
  "max_zoom": 16,
  "filename": "nyc_satellite"
}
\`\`\`

### Get Progress
\`\`\`
GET /progress/{session_id}
\`\`\`

### Download File
\`\`\`
GET /download_file/{filename}
\`\`\`

## 🚨 Troubleshooting

### Common Issues

1. **Backend Connection Failed**
   - Ensure Python server is running on port 5000
   - Check firewall settings
   - Verify Python dependencies are installed

2. **QGIS Not Found**
   - Update QGIS_PATH in app_working.py
   - Manual tile download still works without QGIS

3. **Download Fails**
   - Check internet connection
   - Verify coordinates are valid
   - Reduce zoom level range for testing

4. **Slow Downloads**
   - Large areas take longer to process
   - Higher zoom levels increase tile count exponentially
   - Monitor system resources

### Performance Tips

- Start with small areas (0.001-0.005 degrees)
- Use zoom levels 10-16 for most applications
- Monitor download speed and adjust accordingly
- Close other network-intensive applications

## 🏢 About Shoonya Innovation

Shoonya Innovation is a leading technology company specializing in geospatial solutions and innovative mapping technologies. We provide cutting-edge tools that make geographic data accessible and actionable for businesses worldwide.

### Our Services
- **Geospatial Analytics**: Advanced mapping and location intelligence
- **Custom Development**: Tailored GIS applications
- **Data Processing**: Large-scale geographic dataset handling
- **Consulting**: Expert guidance on geospatial projects

### Contact
- **Website**: www.shoonyainnovation.com
- **Email**: info@shoonyainnovation.com
- **Support**: support@shoonyainnovation.com

## 📄 License

Copyright © 2024 Shoonya Innovation Company. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, or modification is strictly prohibited.
