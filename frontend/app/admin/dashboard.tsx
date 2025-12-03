import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  RefreshControl,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';

// Conditionally import WebView only for native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

const { width, height } = Dimensions.get('window');

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const webViewRef = useRef<any>(null);
  
  const [stats, setStats] = useState<any>({});
  const [activeDrivers, setActiveDrivers] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'alerts' | 'deliveries'>('map');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, driversRes, alertsRes, camerasRes] = await Promise.all([
        api.get('/stats/dashboard'),
        api.get('/location/active'),
        api.get('/alerts?resolved=false'),
        api.get('/cameras'),
      ]);
      
      setStats(statsRes.data);
      setActiveDrivers(driversRes.data);
      setAlerts(alertsRes.data);
      setCameras(camerasRes.data);

      // Update map markers
      if (webViewRef.current && driversRes.data.length > 0) {
        webViewRef.current.injectJavaScript(`
          if (typeof updateDrivers === 'function') {
            updateDrivers(${JSON.stringify(driversRes.data)});
          }
        `);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await api.put(`/alerts/${alertId}/resolve`);
      loadData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de résoudre l\'alerte');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'en_route': return '#00ff88';
      case 'deviation': return '#ff9500';
      case 'emergency': return '#ff4444';
      case 'stopped': return '#888';
      default: return '#00d4ff';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'emergency': return 'warning';
      case 'deviation': return 'git-branch';
      case 'speed': return 'speedometer';
      case 'stopped': return 'pause-circle';
      default: return 'alert-circle';
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ff4444';
      case 'high': return '#ff9500';
      case 'medium': return '#ffcc00';
      default: return '#00d4ff';
    }
  };

  // Admin Map HTML with all drivers and modern infrastructure icons
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        html, body, #map { width: 100%; height: 100%; background: #1a2a3a; }
        .driver-popup { padding: 8px; }
        .driver-popup h4 { margin: 0 0 4px 0; color: #333; }
        .driver-popup p { margin: 2px 0; font-size: 12px; color: #666; }
        .infrastructure-popup { 
          padding: 10px; 
          min-width: 150px;
        }
        .infrastructure-popup h4 { 
          margin: 0 0 6px 0; 
          color: #1a2a3a; 
          font-size: 14px;
          font-weight: 600;
        }
        .infrastructure-popup .type-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
        }
        .leaflet-marker-icon {
          transition: transform 0.2s ease;
        }
        .leaflet-marker-icon:hover {
          transform: scale(1.15);
          z-index: 1000 !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const centerLat = 48.8049;
        const centerLng = 2.1201;
        
        const map = L.map('map').setView([centerLat, centerLng], 14);
        
        // Style de carte moderne (CartoDB Positron)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CartoDB',
          maxZoom: 19
        }).addTo(map);

        // Versailles city boundaries with gradient effect
        const cityBounds = [
          [48.7900, 2.1000],
          [48.7900, 2.1500],
          [48.8200, 2.1500],
          [48.8200, 2.1000]
        ];
        L.polygon(cityBounds, {
          color: '#00d4ff',
          fillColor: '#00d4ff',
          fillOpacity: 0.03,
          weight: 2,
          dashArray: '8, 8'
        }).addTo(map);

        // Configuration des icônes par type d'infrastructure
        const iconConfig = {
          monument: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7V9H22V7L12 2Z" fill="currentColor"/><path d="M4 10V18H6V10H4Z" fill="currentColor"/><path d="M8 10V18H10V10H8Z" fill="currentColor"/><path d="M14 10V18H16V10H14Z" fill="currentColor"/><path d="M18 10V18H20V10H18Z" fill="currentColor"/><path d="M2 19V22H22V19H2Z" fill="currentColor"/></svg>',
            color: '#D4AF37',
            bgColor: '#FFF8E7',
            label: 'Monument'
          },
          station: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9V15L7 17V20H17V17L19 15V9C19 5.13 15.87 2 12 2Z" fill="currentColor"/><circle cx="9" cy="11" r="1.5" fill="white"/><circle cx="15" cy="11" r="1.5" fill="white"/><path d="M8 17H16" stroke="white" stroke-width="2"/><path d="M12 20V23M8 23H16" stroke="currentColor" stroke-width="2"/></svg>',
            color: '#3B82F6',
            bgColor: '#EFF6FF',
            label: 'Gare'
          },
          public: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3L4 9V21H9V14H15V21H20V9L12 3Z" fill="currentColor"/><path d="M12 7L7 11V19H10V13H14V19H17V11L12 7Z" fill="white"/></svg>',
            color: '#8B5CF6',
            bgColor: '#F3E8FF',
            label: 'Édifice Public'
          },
          museum: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7V8H22V7L12 2Z" fill="currentColor"/><rect x="4" y="9" width="3" height="10" fill="currentColor"/><rect x="10" y="9" width="4" height="10" fill="currentColor"/><rect x="17" y="9" width="3" height="10" fill="currentColor"/><rect x="2" y="19" width="20" height="3" fill="currentColor"/><circle cx="12" cy="5" r="1" fill="white"/></svg>',
            color: '#EC4899',
            bgColor: '#FCE7F3',
            label: 'Musée'
          },
          garden: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C9 2 7 5 7 8C7 10 8 11 9 12L8 22H16L15 12C16 11 17 10 17 8C17 5 15 2 12 2Z" fill="currentColor"/><path d="M12 6C11 6 10 7 10 8C10 9 11 10 12 10C13 10 14 9 14 8C14 7 13 6 12 6Z" fill="white"/></svg>',
            color: '#22C55E',
            bgColor: '#DCFCE7',
            label: 'Jardin'
          },
          park: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L8 8H5L12 18L19 8H16L12 2Z" fill="currentColor"/><rect x="11" y="16" width="2" height="6" fill="#8B4513"/><path d="M4 20C4 18 6 16 8 16C10 16 11 17 12 17C13 17 14 16 16 16C18 16 20 18 20 20H4Z" fill="#90EE90"/></svg>',
            color: '#10B981',
            bgColor: '#D1FAE5',
            label: 'Parc'
          },
          hospital: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" fill="currentColor"/><path d="M10 9H14V11H16V15H14V17H10V15H8V11H10V9Z" fill="white"/></svg>',
            color: '#EF4444',
            bgColor: '#FEE2E2',
            label: 'Hôpital'
          },
          school: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L23 9L12 3Z" fill="currentColor"/><path d="M12 6L6 9L12 12L18 9L12 6Z" fill="white"/><path d="M21 9V15" stroke="currentColor" stroke-width="2"/></svg>',
            color: '#F59E0B',
            bgColor: '#FEF3C7',
            label: 'École'
          },
          sport: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 2C12 2 8 6 8 12C8 18 12 22 12 22" stroke="white" stroke-width="1.5"/><path d="M12 2C12 2 16 6 16 12C16 18 12 22 12 22" stroke="white" stroke-width="1.5"/><path d="M2 12H22M4 7H20M4 17H20" stroke="white" stroke-width="1.5"/></svg>',
            color: '#06B6D4',
            bgColor: '#CFFAFE',
            label: 'Sport'
          },
          market: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5L2 9H22L20 5H4Z" fill="currentColor"/><path d="M3 10V20H21V10H3Z" fill="currentColor"/><path d="M7 12V18M12 12V18M17 12V18" stroke="white" stroke-width="1.5"/><path d="M5 5V3H19V5" stroke="currentColor" stroke-width="2"/></svg>',
            color: '#F97316',
            bgColor: '#FFEDD5',
            label: 'Marché'
          },
          culture: {
            svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L4 6V10C4 15.55 7.16 20.74 12 22C16.84 20.74 20 15.55 20 10V6L12 2Z" fill="currentColor"/><path d="M9 11L11 13L15 9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            color: '#A855F7',
            bgColor: '#F3E8FF',
            label: 'Culture'
          }
        };

        // Fonction pour créer une icône SVG avec taille adaptée au zoom
        function createInfraIcon(type, zoom) {
          const config = iconConfig[type] || iconConfig.public;
          // Adapter la taille au niveau de zoom (plus grand = plus zoomé)
          const baseSize = zoom < 13 ? 20 : zoom < 15 ? 28 : zoom < 17 ? 36 : 44;
          const iconSize = baseSize;
          const svgSize = iconSize * 0.6;
          
          return L.divIcon({
            className: 'infrastructure-icon',
            html: \`
              <div style="
                width: \${iconSize}px;
                height: \${iconSize}px;
                background: linear-gradient(135deg, \${config.bgColor} 0%, white 100%);
                border: 2.5px solid \${config.color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 3px 12px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.15);
                cursor: pointer;
              ">
                <div style="
                  width: \${svgSize}px;
                  height: \${svgSize}px;
                  color: \${config.color};
                ">
                  \${config.svg}
                </div>
              </div>
            \`,
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize/2, iconSize/2],
            popupAnchor: [0, -iconSize/2]
          });
        }

        // Infrastructure de Versailles avec toutes les données
        const buildings = [
          // Monuments historiques
          { name: 'Château de Versailles', lat: 48.8049, lng: 2.1201, type: 'monument' },
          { name: 'Grand Trianon', lat: 48.8120, lng: 2.1100, type: 'monument' },
          { name: 'Petit Trianon', lat: 48.8150, lng: 2.1080, type: 'monument' },
          { name: 'Hameau de la Reine', lat: 48.8160, lng: 2.1070, type: 'monument' },
          { name: 'Orangerie de Versailles', lat: 48.8020, lng: 2.1160, type: 'monument' },
          { name: 'Opéra Royal', lat: 48.8050, lng: 2.1205, type: 'monument' },
          { name: 'Grande Écurie', lat: 48.8055, lng: 2.1200, type: 'monument' },
          { name: 'Cathédrale Saint-Louis', lat: 48.8060, lng: 2.1230, type: 'monument' },
          { name: 'Église Notre-Dame', lat: 48.8052, lng: 2.1225, type: 'monument' },
          // Gares
          { name: 'Gare de Versailles-Chantiers', lat: 48.8010, lng: 2.1370, type: 'station' },
          { name: 'Gare de Versailles-Rive Droite', lat: 48.8080, lng: 2.1250, type: 'station' },
          { name: 'Gare de Versailles-Rive Gauche', lat: 48.8000, lng: 2.1300, type: 'station' },
          // Édifices publics
          { name: 'Hôtel de Ville de Versailles', lat: 48.8065, lng: 2.1150, type: 'public' },
          { name: 'Préfecture des Yvelines', lat: 48.8060, lng: 2.1165, type: 'public' },
          { name: 'Bibliothèque municipale', lat: 48.8062, lng: 2.1155, type: 'public' },
          // Musées
          { name: 'Musée Lambinet', lat: 48.8055, lng: 2.1210, type: 'museum' },
          { name: "Musée de l'Histoire de France", lat: 48.8050, lng: 2.1208, type: 'museum' },
          // Parcs et jardins
          { name: 'Potager du Roi', lat: 48.8000, lng: 2.1150, type: 'garden' },
          { name: 'Parc Balbi', lat: 48.8070, lng: 2.1160, type: 'park' },
          { name: 'Parc de Versailles', lat: 48.8080, lng: 2.1150, type: 'park' },
          // Établissements
          { name: 'Hôpital André Mignot', lat: 48.8015, lng: 2.1280, type: 'hospital' },
          { name: 'Lycée Hoche', lat: 48.8075, lng: 2.1240, type: 'school' },
          { name: 'Lycée Jules Ferry', lat: 48.8030, lng: 2.1220, type: 'school' },
          // Sport et commerce
          { name: 'Stade de Montbauron', lat: 48.8020, lng: 2.1250, type: 'sport' },
          { name: 'Piscine de Montbauron', lat: 48.8025, lng: 2.1255, type: 'sport' },
          { name: 'Marché Notre-Dame', lat: 48.8055, lng: 2.1220, type: 'market' },
          { name: 'Théâtre Montansier', lat: 48.8058, lng: 2.1215, type: 'culture' },
        ];

        // Stocker les marqueurs d'infrastructure pour mise à jour
        let infraMarkers = [];

        // Fonction pour créer les marqueurs d'infrastructure
        function createInfraMarkers() {
          // Supprimer les anciens marqueurs
          infraMarkers.forEach(m => map.removeLayer(m));
          infraMarkers = [];
          
          const currentZoom = map.getZoom();
          
          buildings.forEach(b => {
            const config = iconConfig[b.type] || iconConfig.public;
            const marker = L.marker([b.lat, b.lng], {
              icon: createInfraIcon(b.type, currentZoom)
            }).bindPopup(\`
              <div class="infrastructure-popup">
                <h4>\${b.name}</h4>
                <span class="type-badge" style="background: \${config.bgColor}; color: \${config.color};">
                  \${config.label}
                </span>
              </div>
            \`).addTo(map);
            
            infraMarkers.push(marker);
          });
        }

        // Créer les marqueurs initiaux
        createInfraMarkers();

        // Mettre à jour les marqueurs lors du changement de zoom
        map.on('zoomend', function() {
          createInfraMarkers();
        });

        // Cameras avec icône moderne
        const cameras = ${JSON.stringify(cameras)};
        cameras.forEach(cam => {
          const camSize = map.getZoom() < 14 ? 18 : 24;
          L.marker([cam.location.lat, cam.location.lng], {
            icon: L.divIcon({
              className: 'camera-icon',
              html: \`
                <div style="
                  width: \${camSize}px;
                  height: \${camSize}px;
                  background: linear-gradient(135deg, #9333EA 0%, #7C3AED 100%);
                  border: 2px solid #fff;
                  border-radius: 6px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 8px rgba(147, 51, 234, 0.4);
                ">
                  <svg width="\${camSize*0.6}" height="\${camSize*0.6}" viewBox="0 0 24 24" fill="white">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                </div>
              \`,
              iconSize: [camSize, camSize],
              iconAnchor: [camSize/2, camSize/2]
            })
          }).bindPopup('<b>' + cam.name + '</b><br>Zone: ' + cam.zone).addTo(map);
        });

        // Driver markers
        let driverMarkers = {};

        window.updateDrivers = function(drivers) {
          // Remove old markers
          Object.values(driverMarkers).forEach(m => map.removeLayer(m));
          driverMarkers = {};

          drivers.forEach(driver => {
            const color = driver.status === 'en_route' ? '#10B981' : 
                         driver.status === 'deviation' ? '#F59E0B' : 
                         driver.status === 'emergency' ? '#EF4444' : '#6B7280';
            
            const vehicleIcon = driver.vehicle_type === 'truck' ? 
              '<svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>' :
              driver.vehicle_type === 'van' ? 
              '<svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H15V3H9v2H6.5c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>' :
              '<svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>';
            
            const marker = L.marker([driver.latitude, driver.longitude], {
              icon: L.divIcon({
                className: 'driver-marker',
                html: \`
                  <div style="
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, \${color} 0%, \${color}dd 100%);
                    border-radius: 50%;
                    border: 3px solid #fff;
                    box-shadow: 0 3px 12px \${color}66;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: pulse 2s infinite;
                  ">
                    \${vehicleIcon}
                  </div>
                  <style>
                    @keyframes pulse {
                      0%, 100% { box-shadow: 0 3px 12px \${color}66; }
                      50% { box-shadow: 0 3px 20px \${color}99; }
                    }
                  </style>
                \`,
                iconSize: [46, 46],
                iconAnchor: [23, 23]
              })
            }).bindPopup(\`
              <div class="driver-popup">
                <h4>\${driver.driver_name}</h4>
                <p><strong>Itinéraire:</strong> \${driver.route_name}</p>
                <p><strong>Vitesse:</strong> \${(driver.speed || 0).toFixed(0)} km/h</p>
                <p><strong>Statut:</strong> \${driver.status === 'en_route' ? 'En route' : driver.status === 'deviation' ? 'Déviation' : driver.status === 'emergency' ? 'Urgence' : 'Arrêté'}</p>
              </div>
            \`).addTo(map);
            
            driverMarkers[driver.driver_id] = marker;
          });
        };

        // Initialize with current drivers
        const initialDrivers = ${JSON.stringify(activeDrivers)};
        if (initialDrivers.length > 0) {
          window.updateDrivers(initialDrivers);
        }
      </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tableau de bord</Text>
          <Text style={styles.headerSubtitle}>Site Industriel Demo</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/admin/deliveries')}
          >
            <Ionicons name="list" size={22} color="#00d4ff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#ff4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsContainer}
        contentContainerStyle={styles.statsContent}
      >
        <View style={styles.statCard}>
          <Ionicons name="car" size={24} color="#00d4ff" />
          <Text style={styles.statValue}>{stats.active_drivers || 0}</Text>
          <Text style={styles.statLabel}>Véhicules actifs</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="cube" size={24} color="#00ff88" />
          <Text style={styles.statValue}>{stats.in_progress || 0}</Text>
          <Text style={styles.statLabel}>En cours</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color="#ff9500" />
          <Text style={styles.statValue}>{stats.completed_today || 0}</Text>
          <Text style={styles.statLabel}>Terminées</Text>
        </View>
        <View style={[styles.statCard, alerts.length > 0 && styles.statCardAlert]}>
          <Ionicons name="warning" size={24} color={alerts.length > 0 ? '#ff4444' : '#888'} />
          <Text style={[styles.statValue, alerts.length > 0 && styles.statValueAlert]}>
            {alerts.length}
          </Text>
          <Text style={styles.statLabel}>Alertes</Text>
        </View>
      </ScrollView>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'map' && styles.tabActive]}
          onPress={() => setActiveTab('map')}
        >
          <Ionicons name="map" size={18} color={activeTab === 'map' ? '#00d4ff' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>Carte</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'alerts' && styles.tabActive]}
          onPress={() => setActiveTab('alerts')}
        >
          <Ionicons name="warning" size={18} color={activeTab === 'alerts' ? '#00d4ff' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'alerts' && styles.tabTextActive]}>
            Alertes ({alerts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'deliveries' && styles.tabActive]}
          onPress={() => setActiveTab('deliveries')}
        >
          <Ionicons name="videocam" size={18} color={activeTab === 'deliveries' ? '#00d4ff' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'deliveries' && styles.tabTextActive]}>Caméras</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'map' && (
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={mapHtml}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any}
              title="Admin Map"
            />
          ) : WebView ? (
            <WebView
              ref={webViewRef}
              source={{ html: mapHtml }}
              style={styles.map}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          ) : (
            <View style={[styles.map, { justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="map" size={64} color="#00d4ff" />
              <Text style={{ color: '#fff', marginTop: 16 }}>Carte non disponible</Text>
            </View>
          )}
          
          {/* Active Drivers List */}
          {activeDrivers.length > 0 && (
            <View style={styles.driversOverlay}>
              <Text style={styles.driversTitle}>Véhicules actifs</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {activeDrivers.map((driver) => (
                  <TouchableOpacity
                    key={driver.driver_id}
                    style={[
                      styles.driverChip,
                      { borderColor: getStatusColor(driver.status) },
                    ]}
                    onPress={() => setSelectedDriver(driver)}
                  >
                    <View style={[styles.driverStatus, { backgroundColor: getStatusColor(driver.status) }]} />
                    <Text style={styles.driverChipText}>{driver.driver_name}</Text>
                    <Text style={styles.driverSpeed}>{(driver.speed || 0).toFixed(0)} km/h</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {activeTab === 'alerts' && (
        <ScrollView
          style={styles.alertsContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#00d4ff" />
          }
        >
          {alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={64} color="#00ff88" />
              <Text style={styles.emptyText}>Aucune alerte active</Text>
            </View>
          ) : (
            alerts.map((alert) => (
              <View
                key={alert.id}
                style={[styles.alertCard, { borderLeftColor: getAlertColor(alert.severity) }]}
              >
                <View style={styles.alertHeader}>
                  <View style={styles.alertIconContainer}>
                    <Ionicons
                      name={getAlertIcon(alert.type) as any}
                      size={24}
                      color={getAlertColor(alert.severity)}
                    />
                  </View>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertType}>{alert.type.toUpperCase()}</Text>
                    <Text style={styles.alertDriver}>{alert.driver_name}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.resolveButton}
                    onPress={() => handleResolveAlert(alert.id)}
                  >
                    <Ionicons name="checkmark" size={20} color="#00ff88" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                <Text style={styles.alertTime}>
                  {new Date(alert.created_at).toLocaleTimeString('fr-FR')}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {activeTab === 'deliveries' && (
        <ScrollView style={styles.camerasContainer}>
          <Text style={styles.sectionTitle}>Caméras de surveillance</Text>
          <View style={styles.camerasGrid}>
            {cameras.map((camera) => (
              <TouchableOpacity
                key={camera.id}
                style={styles.cameraCard}
                onPress={() => {
                  setSelectedCamera(camera);
                  setShowCameraModal(true);
                }}
              >
                <View style={styles.cameraPreview}>
                  <Ionicons name="videocam" size={32} color="#00d4ff" />
                  <Text style={styles.cameraLive}>LIVE</Text>
                </View>
                <Text style={styles.cameraName}>{camera.name}</Text>
                <Text style={styles.cameraZone}>{camera.zone}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Camera Modal */}
      <Modal visible={showCameraModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedCamera?.name}</Text>
              <TouchableOpacity onPress={() => setShowCameraModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.cameraFeed}>
              <Ionicons name="videocam" size={64} color="#00d4ff" />
              <Text style={styles.cameraFeedText}>Flux vidéo simulé</Text>
              <Text style={styles.cameraFeedSubtext}>
                Zone: {selectedCamera?.zone}
              </Text>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Enregistrement en cours</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Driver Details Modal */}
      <Modal visible={!!selectedDriver} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedDriver?.driver_name}</Text>
              <TouchableOpacity onPress={() => setSelectedDriver(null)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.driverDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="navigate" size={20} color="#00d4ff" />
                <Text style={styles.detailText}>{selectedDriver?.route_name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="speedometer" size={20} color="#00d4ff" />
                <Text style={styles.detailText}>
                  {(selectedDriver?.speed || 0).toFixed(0)} km/h
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="car" size={20} color="#00d4ff" />
                <Text style={styles.detailText}>
                  {selectedDriver?.vehicle_type === 'truck' ? 'Camion' :
                   selectedDriver?.vehicle_type === 'van' ? 'Camionnette' : 'VL'}
                  {selectedDriver?.license_plate && ` - ${selectedDriver.license_plate}`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(selectedDriver?.status) }]} />
                <Text style={styles.detailText}>
                  Statut: {selectedDriver?.status === 'en_route' ? 'En route' :
                          selectedDriver?.status === 'deviation' ? 'Déviation' :
                          selectedDriver?.status === 'emergency' ? 'Urgence' : 'Arrêté'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => Alert.alert('Message', 'Contacter le livreur')}
            >
              <Ionicons name="chatbubble" size={20} color="#fff" />
              <Text style={styles.contactButtonText}>Contacter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  statsContainer: {
    maxHeight: 100,
  },
  statsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 90,
    marginRight: 12,
  },
  statCardAlert: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statValueAlert: {
    color: '#ff4444',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#00d4ff',
  },
  tabText: {
    color: '#888',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#00d4ff',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  driversOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 22, 40, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  driversTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 8,
  },
  driverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
  },
  driverStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  driverChipText: {
    color: '#fff',
    fontSize: 13,
  },
  driverSpeed: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  alertsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    marginTop: 16,
  },
  alertCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertInfo: {
    flex: 1,
    marginLeft: 12,
  },
  alertType: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  alertDriver: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  resolveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 12,
  },
  alertTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 8,
  },
  camerasContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  camerasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cameraCard: {
    width: (width - 44) / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cameraPreview: {
    height: 100,
    backgroundColor: '#1a2a3a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cameraLive: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  cameraName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  cameraZone: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a1628',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: height * 0.6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cameraFeed: {
    height: 200,
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFeedText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  cameraFeedSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 4,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#ff4444',
    fontSize: 12,
  },
  driverDetails: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailText: {
    color: '#fff',
    fontSize: 15,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00d4ff',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
