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

  // Calculate default center coordinates
  const defaultLat = route?.waypoints?.[0]?.lat || currentLocation?.latitude || 48.8566;
  const defaultLng = route?.waypoints?.[0]?.lng || currentLocation?.longitude || 2.3522;
  const driverLatValue = currentLocation?.latitude || defaultLat;
  const driverLngValue = currentLocation?.longitude || defaultLng;

  // OpenStreetMap HTML
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
        .driver-icon {
          background: #00d4ff;
          border-radius: 50%;
          border: 3px solid #fff;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .waypoint-icon {
          background: #ff9500;
          border-radius: 50%;
          border: 2px solid #fff;
        }
        .destination-icon {
          background: #00ff88;
          border-radius: 50%;
          border: 3px solid #fff;
        }
        .danger-zone {
          fill: #ff4444;
          fill-opacity: 0.3;
          stroke: #ff4444;
          stroke-width: 2;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const centerLat = ${defaultLat};
        const centerLng = ${defaultLng};
        
        const map = L.map('map').setView([centerLat, centerLng], 16);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // Route waypoints
        const waypoints = ${JSON.stringify(route?.waypoints || [])};
        const destination = ${JSON.stringify(route?.destination || {})};
        const dangerZones = ${JSON.stringify(route?.danger_zones || [])};

        // Draw route line
        if (waypoints.length > 0) {
          const routeCoords = waypoints.map(w => [w.lat, w.lng]);
          if (destination.lat) routeCoords.push([destination.lat, destination.lng]);
          
          L.polyline(routeCoords, {
            color: '#00d4ff',
            weight: 5,
            opacity: 0.8
          }).addTo(map);

          // Add waypoint markers
          waypoints.forEach((wp, i) => {
            L.circleMarker([wp.lat, wp.lng], {
              radius: 8,
              fillColor: '#ff9500',
              color: '#fff',
              weight: 2,
              fillOpacity: 1
            }).bindPopup(wp.name || 'Point ' + (i+1)).addTo(map);
          });
        }

        // Destination marker
        if (destination.lat) {
          L.marker([destination.lat, destination.lng], {
            icon: L.divIcon({
              className: 'destination-marker',
              html: '<div style="background:#00ff88;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.3);"></div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            })
          }).bindPopup('<b>' + (destination.name || 'Destination') + '</b>').addTo(map);
        }

        // Danger zones
        dangerZones.forEach(zone => {
          L.circle([zone.lat, zone.lng], {
            radius: zone.radius || 50,
            color: '#ff4444',
            fillColor: '#ff4444',
            fillOpacity: 0.2,
            weight: 2
          }).bindPopup('Zone danger: ' + (zone.description || '')).addTo(map);
        });

        // Driver marker
        let driverMarker = null;
        const driverLat = ${driverLatValue};
        const driverLng = ${driverLngValue};
        
        driverMarker = L.marker([driverLat, driverLng], {
          icon: L.divIcon({
            className: 'driver-marker',
            html: '<div style="background:#00d4ff;width:24px;height:24px;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 10px rgba(0,212,255,0.5);"></div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
        />

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
