import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

// Conditionally import WebView only for native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

const { width, height } = Dimensions.get('window');

export default function Navigation() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const { deliveryId, routeId, routeName } = params;
  
  const [route, setRoute] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [currentWaypoint, setCurrentWaypoint] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const locationSubscription = useRef<any>(null);
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    loadRoute();
    startLocationTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const loadRoute = async () => {
    try {
      const response = await api.get(`/routes/${routeId}`);
      setRoute(response.data);
      setDistanceRemaining(response.data.distance || 1.2);
      setTimeRemaining(response.data.estimated_time || 8);
    } catch (error) {
      console.error('Error loading route:', error);
    }
  };

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'La permission de localisation est requise pour la navigation.');
      return;
    }

    // Get initial location
    const location = await Location.getCurrentPositionAsync({});
    setCurrentLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    // Start watching location
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      (location) => {
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setCurrentLocation(newLocation);
        setSpeed(location.coords.speed ? location.coords.speed * 3.6 : 0); // Convert to km/h

        // Update location on server
        if (isNavigating && deliveryId) {
          updateLocationOnServer(newLocation, location.coords.speed || 0, location.coords.heading || 0);
        }

        // Update map
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            if (typeof updateDriverPosition === 'function') {
              updateDriverPosition(${newLocation.latitude}, ${newLocation.longitude});
            }
          `);
        }
      }
    );
  };

  const updateLocationOnServer = async (location: any, speed: number, heading: number) => {
    try {
      await api.post('/location/update', {
        driver_id: user?.id || 'demo-driver',
        delivery_id: deliveryId,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: speed * 3.6, // km/h
        heading: heading,
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const startNavigation = async () => {
    setIsNavigating(true);
    try {
      await api.put(`/deliveries/${deliveryId}/status?status=in_progress`);
    } catch (error) {
      console.error('Error starting delivery:', error);
    }
  };

  const handleEmergency = async () => {
    Alert.alert(
      'Urgence',
      'Êtes-vous sûr de vouloir signaler une urgence ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/alerts/emergency', {
                driver_id: user?.id || 'demo-driver',
                driver_name: user?.name || 'Livreur Demo',
                delivery_id: deliveryId,
                latitude: currentLocation?.latitude || 0,
                longitude: currentLocation?.longitude || 0,
                message: 'Urgence signalée par le livreur',
              });
              Alert.alert('Alerte envoyée', 'Le centre de contrôle a été notifié.');
            } catch (error) {
              Alert.alert('Erreur', "Impossible d'envoyer l'alerte");
            }
          },
        },
      ]
    );
  };

  const handleArrival = async () => {
    try {
      await api.put(`/deliveries/${deliveryId}/status?status=completed`);
      Alert.alert(
        'Arrivée confirmée',
        'Votre livraison a été enregistrée avec succès.',
        [{ text: 'OK', onPress: () => router.replace('/driver/home') }]
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de confirmer l\'arrivée');
    }
  };

  // Calculate default center coordinates (Versailles)
  const defaultLat = route?.waypoints?.[0]?.lat || currentLocation?.latitude || 48.8049;
  const defaultLng = route?.waypoints?.[0]?.lng || currentLocation?.longitude || 2.1201;
  const driverLatValue = currentLocation?.latitude || defaultLat;
  const driverLngValue = currentLocation?.longitude || defaultLng;

  // OpenStreetMap HTML with modern icons
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        html, body, #map { width: 100%; height: 100%; }
        .leaflet-marker-icon {
          transition: transform 0.2s ease;
        }
        .leaflet-marker-icon:hover {
          transform: scale(1.1);
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.4); }
          50% { box-shadow: 0 0 0 15px rgba(0, 212, 255, 0); }
        }
        @keyframes destinationPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const centerLat = ${defaultLat};
        const centerLng = ${defaultLng};
        
        const map = L.map('map').setView([centerLat, centerLng], 16);
        
        // Style de carte moderne (CartoDB Voyager)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CartoDB',
          maxZoom: 19
        }).addTo(map);

        // Configuration des icônes par type de destination
        const destinationIcons = {
          monument: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7V9H22V7L12 2Z"/><path d="M4 10V18H6V10H4Z"/><path d="M8 10V18H10V10H8Z"/><path d="M14 10V18H16V10H14Z"/><path d="M18 10V18H20V10H18Z"/><path d="M2 19V22H22V19H2Z"/></svg>',
            color: '#D4AF37',
            bgColor: '#FFF8E7'
          },
          station: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9V15L7 17V20H17V17L19 15V9C19 5.13 15.87 2 12 2Z"/><circle cx="9" cy="11" r="1.5" fill="white"/><circle cx="15" cy="11" r="1.5" fill="white"/></svg>',
            color: '#3B82F6',
            bgColor: '#EFF6FF'
          },
          public: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L4 9V21H9V14H15V21H20V9L12 3Z"/></svg>',
            color: '#8B5CF6',
            bgColor: '#F3E8FF'
          },
          museum: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7V8H22V7L12 2Z"/><rect x="4" y="9" width="3" height="10"/><rect x="10" y="9" width="4" height="10"/><rect x="17" y="9" width="3" height="10"/><rect x="2" y="19" width="20" height="3"/></svg>',
            color: '#EC4899',
            bgColor: '#FCE7F3'
          },
          garden: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C9 2 7 5 7 8C7 10 8 11 9 12L8 22H16L15 12C16 11 17 10 17 8C17 5 15 2 12 2Z"/></svg>',
            color: '#22C55E',
            bgColor: '#DCFCE7'
          },
          hospital: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M10 9H14V11H16V15H14V17H10V15H8V11H10V9Z" fill="white"/></svg>',
            color: '#EF4444',
            bgColor: '#FEE2E2'
          },
          school: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L23 9L12 3Z"/></svg>',
            color: '#F59E0B',
            bgColor: '#FEF3C7'
          },
          sport: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 2C12 2 8 6 8 12C8 18 12 22 12 22" stroke="white" stroke-width="1.5" fill="none"/><path d="M2 12H22" stroke="white" stroke-width="1.5"/></svg>',
            color: '#06B6D4',
            bgColor: '#CFFAFE'
          },
          market: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 5L2 9H22L20 5H4Z"/><path d="M3 10V20H21V10H3Z"/></svg>',
            color: '#F97316',
            bgColor: '#FFEDD5'
          },
          default: {
            svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>',
            color: '#10B981',
            bgColor: '#D1FAE5'
          }
        };

        // Route waypoints
        const waypoints = ${JSON.stringify(route?.waypoints || [])};
        const destination = ${JSON.stringify(route?.destination || {})};
        const dangerZones = ${JSON.stringify(route?.danger_zones || [])};

        // Draw route line with gradient effect
        if (waypoints.length > 0) {
          const routeCoords = waypoints.map(w => [w.lat, w.lng]);
          if (destination.lat) routeCoords.push([destination.lat, destination.lng]);
          
          // Route background (shadow)
          L.polyline(routeCoords, {
            color: '#0891B2',
            weight: 10,
            opacity: 0.3,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
          
          // Main route line
          L.polyline(routeCoords, {
            color: '#00d4ff',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          // Add waypoint markers with modern style
          waypoints.forEach((wp, i) => {
            L.marker([wp.lat, wp.lng], {
              icon: L.divIcon({
                className: 'waypoint-marker',
                html: \`
                  <div style="
                    width: 28px;
                    height: 28px;
                    background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
                    border-radius: 50%;
                    border: 3px solid #fff;
                    box-shadow: 0 3px 10px rgba(245, 158, 11, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                  ">
                    \${i + 1}
                  </div>
                \`,
                iconSize: [34, 34],
                iconAnchor: [17, 17]
              })
            }).bindPopup('<b>' + (wp.name || 'Point ' + (i+1)) + '</b>').addTo(map);
          });
        }

        // Destination marker with beautiful icon
        if (destination.lat) {
          const destType = destination.type || 'default';
          const iconConfig = destinationIcons[destType] || destinationIcons.default;
          
          L.marker([destination.lat, destination.lng], {
            icon: L.divIcon({
              className: 'destination-marker',
              html: \`
                <div style="
                  width: 48px;
                  height: 48px;
                  background: linear-gradient(135deg, \${iconConfig.bgColor} 0%, white 100%);
                  border: 3px solid \${iconConfig.color};
                  border-radius: 50%;
                  box-shadow: 0 4px 15px \${iconConfig.color}66;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  animation: destinationPulse 2s infinite;
                ">
                  <div style="width: 26px; height: 26px; color: \${iconConfig.color};">
                    \${iconConfig.svg}
                  </div>
                </div>
              \`,
              iconSize: [54, 54],
              iconAnchor: [27, 27],
              popupAnchor: [0, -27]
            })
          }).bindPopup(\`
            <div style="padding: 8px; min-width: 150px;">
              <h4 style="margin: 0 0 4px 0; color: #1a2a3a; font-size: 14px;">\${destination.name || 'Destination'}</h4>
              <span style="
                display: inline-block;
                padding: 2px 8px;
                background: \${iconConfig.bgColor};
                color: \${iconConfig.color};
                border-radius: 10px;
                font-size: 10px;
                font-weight: 500;
                text-transform: uppercase;
              ">\${destType}</span>
            </div>
          \`).addTo(map);
        }

        // Danger zones with modern style
        dangerZones.forEach(zone => {
          L.circle([zone.lat, zone.lng], {
            radius: zone.radius || 50,
            color: '#EF4444',
            fillColor: '#EF4444',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '5, 5'
          }).bindPopup(\`
            <div style="padding: 8px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#EF4444">
                  <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                </svg>
                <span style="font-weight: 600; color: #EF4444;">Zone de danger</span>
              </div>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">\${zone.description || ''}</p>
            </div>
          \`).addTo(map);
        });

        // Driver marker with beautiful animation
        let driverMarker = null;
        const driverLat = ${driverLatValue};
        const driverLng = ${driverLngValue};
        
        driverMarker = L.marker([driverLat, driverLng], {
          icon: L.divIcon({
            className: 'driver-marker',
            html: \`
              <div style="
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, #00d4ff 0%, #0891B2 100%);
                border-radius: 50%;
                border: 4px solid #fff;
                box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.4);
                animation: pulse 2s infinite;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
                </svg>
              </div>
            \`,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          })
        }).addTo(map);

        // Function to update driver position
        window.updateDriverPosition = function(lat, lng) {
          if (driverMarker) {
            driverMarker.setLatLng([lat, lng]);
            map.panTo([lat, lng]);
          }
        };

        // Fit bounds to show full route
        if (waypoints.length > 0 && destination.lat) {
          const allPoints = [...waypoints.map(w => [w.lat, w.lng]), [destination.lat, destination.lng]];
          map.fitBounds(allPoints, { padding: [50, 50] });
        }
      </script>
    </body>
    </html>
  `;

  // Render map component based on platform
  const renderMap = () => {
    if (Platform.OS === 'web') {
      // Use iframe for web platform
      return (
        <iframe
          srcDoc={mapHtml}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any}
          title="Navigation Map"
        />
      );
    } else if (WebView) {
      // Use WebView for native platforms
      return (
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
        />
      );
    } else {
      return (
        <View style={[styles.map, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="map" size={64} color="#00d4ff" />
          <Text style={{ color: '#fff', marginTop: 16 }}>Carte non disponible</Text>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {renderMap()}

        {/* Header Overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.routeInfo}>
            <Text style={styles.routeName}>{routeName || 'Navigation'}</Text>
            <Text style={styles.routeStatus}>
              {isNavigating ? 'En cours...' : 'Prêt à démarrer'}
            </Text>
          </View>
          <TouchableOpacity style={styles.detailsButton} onPress={() => setShowDetails(!showDetails)}>
            <Ionicons name={showDetails ? 'chevron-up' : 'information-circle'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Details Panel */}
        {showDetails && route && (
          <View style={styles.detailsPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {route.waypoints?.map((wp: any, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.waypointCard,
                    index === currentWaypoint && styles.waypointCardActive,
                  ]}
                >
                  <Ionicons
                    name={index < currentWaypoint ? 'checkmark-circle' : 'navigate-circle'}
                    size={24}
                    color={index === currentWaypoint ? '#00d4ff' : '#888'}
                  />
                  <Text style={styles.waypointName}>{wp.name}</Text>
                </View>
              ))}
              <View style={[styles.waypointCard, styles.destinationCard]}>
                <Ionicons name="flag" size={24} color="#00ff88" />
                <Text style={styles.waypointName}>{route.destination?.name}</Text>
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Navigation Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="speedometer" size={24} color="#00d4ff" />
            <Text style={styles.statValue}>{speed.toFixed(0)}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={24} color="#ff9500" />
            <Text style={styles.statValue}>{distanceRemaining.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={24} color="#00ff88" />
            <Text style={styles.statValue}>{timeRemaining}</Text>
            <Text style={styles.statLabel}>min</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergency}>
            <Ionicons name="warning" size={28} color="#fff" />
          </TouchableOpacity>

          {!isNavigating ? (
            <TouchableOpacity style={styles.startButton} onPress={startNavigation}>
              <Ionicons name="play" size={28} color="#0a1628" />
              <Text style={styles.startButtonText}>Démarrer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.arrivalButton} onPress={handleArrival}>
              <Ionicons name="checkmark-circle" size={28} color="#fff" />
              <Text style={styles.arrivalButtonText}>Confirmer arrivée</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => Alert.alert('Message', 'Fonctionnalité de messagerie')}
          >
            <Ionicons name="chatbubble" size={24} color="#00d4ff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(10, 22, 40, 0.9)',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  routeName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  routeStatus: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  detailsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsPanel: {
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 22, 40, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  waypointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  waypointCardActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  destinationCard: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
  },
  waypointName: {
    color: '#fff',
    fontSize: 13,
  },
  bottomPanel: {
    backgroundColor: '#0a1628',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emergencyButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButton: {
    flex: 1,
    maxWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    backgroundColor: '#00d4ff',
    borderRadius: 28,
  },
  startButtonText: {
    color: '#0a1628',
    fontSize: 18,
    fontWeight: '600',
  },
  arrivalButton: {
    flex: 1,
    maxWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    backgroundColor: '#00ff88',
    borderRadius: 28,
  },
  arrivalButtonText: {
    color: '#0a1628',
    fontSize: 16,
    fontWeight: '600',
  },
  messageButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00d4ff',
  },
});
