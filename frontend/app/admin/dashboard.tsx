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

  // Admin Map HTML with all drivers
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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const centerLat = 48.8566;
        const centerLng = 2.3522;
        
        const map = L.map('map').setView([centerLat, centerLng], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // Site boundaries (demo)
        const siteBounds = [
          [48.8546, 2.3482],
          [48.8546, 2.3582],
          [48.8596, 2.3582],
          [48.8596, 2.3482]
        ];
        L.polygon(siteBounds, {
          color: '#00d4ff',
          fillColor: '#00d4ff',
          fillOpacity: 0.05,
          weight: 2,
          dashArray: '5, 10'
        }).addTo(map);

        // Buildings (demo)
        const buildings = [
          { name: 'Bâtiment Principal', lat: 48.8568, lng: 2.3525, type: 'office' },
          { name: 'Entrepôt A', lat: 48.8575, lng: 2.3545, type: 'warehouse' },
          { name: 'Entrepôt B', lat: 48.8550, lng: 2.3560, type: 'warehouse' },
          { name: 'Zone Technique', lat: 48.8585, lng: 2.3495, type: 'technical' },
          { name: 'Quai A', lat: 48.8580, lng: 2.3550, type: 'dock' },
        ];

        buildings.forEach(b => {
          const color = b.type === 'dock' ? '#00ff88' : b.type === 'warehouse' ? '#ff9500' : '#00d4ff';
          L.circleMarker([b.lat, b.lng], {
            radius: 15,
            fillColor: color,
            color: '#fff',
            weight: 2,
            fillOpacity: 0.7
          }).bindPopup('<b>' + b.name + '</b>').addTo(map);
        });

        // Cameras
        const cameras = ${JSON.stringify(cameras)};
        cameras.forEach(cam => {
          L.marker([cam.location.lat, cam.location.lng], {
            icon: L.divIcon({
              className: 'camera-icon',
              html: '<div style="background:#9c27b0;width:16px;height:16px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;"><span style="font-size:10px;">\uD83D\uDCF9</span></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
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
            const color = driver.status === 'en_route' ? '#00ff88' : 
                         driver.status === 'deviation' ? '#ff9500' : 
                         driver.status === 'emergency' ? '#ff4444' : '#888';
            
            const icon = driver.vehicle_type === 'truck' ? '\uD83D\uDE9A' : 
                        driver.vehicle_type === 'van' ? '\uD83D\uDE90' : '\uD83D\uDE97';
            
            const marker = L.marker([driver.latitude, driver.longitude], {
              icon: L.divIcon({
                className: 'driver-marker',
                html: '<div style="background:' + color + ';width:32px;height:32px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;">' + icon + '</div>',
                iconSize: [38, 38],
                iconAnchor: [19, 19]
              })
            }).bindPopup(
              '<div class="driver-popup">' +
              '<h4>' + driver.driver_name + '</h4>' +
              '<p>Itinéraire: ' + driver.route_name + '</p>' +
              '<p>Vitesse: ' + (driver.speed || 0).toFixed(0) + ' km/h</p>' +
              '<p>Statut: ' + driver.status + '</p>' +
              '</div>'
            ).addTo(map);
            
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
