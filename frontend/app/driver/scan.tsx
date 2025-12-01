import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera, useCameraPermissions } from 'expo-camera';
import api from '../../src/services/api';

const { width, height } = Dimensions.get('window');

export default function ScanQR() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || isLoading) return;
    setScanned(true);
    setIsLoading(true);

    try {
      // Parse QR data
      let qrData;
      try {
        qrData = JSON.parse(data);
      } catch {
        qrData = { raw: data };
      }

      // Call API to process QR code
      const response = await api.post('/qr/scan', { qr_data: qrData });
      
      if (response.data.success) {
        const { delivery, route } = response.data;
        
        // Navigate to navigation screen with delivery data
        router.push({
          pathname: '/driver/navigation',
          params: {
            deliveryId: delivery.id,
            routeId: route.id,
            routeName: route.name,
          },
        });
      }
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error.response?.data?.detail || 'QR Code invalide ou livraison non trouvée',
        [{ text: 'Réessayer', onPress: () => setScanned(false) }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Demo mode - simulate QR scan
  const handleDemoScan = async () => {
    setIsLoading(true);
    try {
      // Create a demo delivery
      const deliveryResponse = await api.post('/deliveries', {
        route_id: 'route-1',
        company: 'Démo Entreprise',
        notes: 'Livraison de démonstration',
        vehicle_type: 'truck',
      });
      
      const delivery = deliveryResponse.data;
      
      router.push({
        pathname: '/driver/navigation',
        params: {
          deliveryId: delivery.id,
          routeId: delivery.route_id,
          routeName: delivery.route_name || 'Quai A - Chargement Principal',
        },
      });
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de créer la livraison démo');
    } finally {
      setIsLoading(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#00d4ff" />
          <Text style={styles.loadingText}>Chargement de la caméra...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="camera-outline" size={80} color="#00d4ff" />
          <Text style={styles.permissionTitle}>Accès à la caméra requis</Text>
          <Text style={styles.permissionText}>
            Pour scanner les QR codes, nous avons besoin d'accéder à votre caméra.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.demoButton} onPress={handleDemoScan}>
            <Ionicons name="play-circle-outline" size={22} color="#00d4ff" />
            <Text style={styles.demoButtonText}>Mode Démo (sans caméra)</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.backButtonAbsolute} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scanner QR Code</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Scan Frame */}
          <View style={styles.scanFrameContainer}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#00d4ff" />
                </View>
              )}
            </View>
            <Text style={styles.scanText}>
              Placez le QR code dans le cadre
            </Text>
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setScanned(false)}
              disabled={!scanned}
            >
              <Ionicons name="refresh" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Rescanner</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.demoScanButton} onPress={handleDemoScan}>
              <Ionicons name="play-circle" size={24} color="#0a1628" />
              <Text style={styles.demoScanButtonText}>Démo</Text>
            </TouchableOpacity>
          </View>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#00d4ff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
  },
  demoButtonText: {
    color: '#00d4ff',
    fontSize: 16,
  },
  backButtonAbsolute: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    backgroundColor: 'rgba(10, 22, 40, 0.8)',
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scanFrameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#00d4ff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 22, 40, 0.9)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  demoScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#00d4ff',
    borderRadius: 12,
  },
  demoScanButtonText: {
    color: '#0a1628',
    fontSize: 16,
    fontWeight: '600',
  },
});
