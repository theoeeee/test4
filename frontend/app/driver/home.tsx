import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';

export default function DriverHome() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadDeliveries();
  }, []);

  const loadDeliveries = async () => {
    try {
      const response = await api.get('/deliveries');
      // Filter deliveries for current driver
      const myDeliveries = response.data.filter(
        (d: any) => d.driver_id === user?.id || !d.driver_id
      );
      setDeliveries(myDeliveries.slice(0, 5)); // Show last 5
    } catch (error) {
      console.error('Error loading deliveries:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadDeliveries();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ff9500';
      case 'in_progress': return '#00d4ff';
      case 'completed': return '#00ff88';
      case 'cancelled': return '#ff4444';
      default: return '#888';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.userName}>{user?.name || 'Livreur'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ff4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#00d4ff" />
        }
      >
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.mainAction}
            onPress={() => router.push('/driver/scan')}
          >
            <View style={styles.mainActionIcon}>
              <Ionicons name="qr-code" size={40} color="#0a1628" />
            </View>
            <Text style={styles.mainActionText}>Scanner QR Code</Text>
            <Text style={styles.mainActionSubtext}>Commencer une livraison</Text>
          </TouchableOpacity>
        </View>

        {/* Driver Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Mon profil</Text>
          <View style={styles.infoRow}>
            <Ionicons name="car" size={20} color="#00d4ff" />
            <Text style={styles.infoText}>
              {user?.vehicle_type === 'truck' ? 'Camion' : 
               user?.vehicle_type === 'van' ? 'Camionnette' : 'Véhicule léger'}
            </Text>
          </View>
          {user?.license_plate && (
            <View style={styles.infoRow}>
              <Ionicons name="card" size={20} color="#00d4ff" />
              <Text style={styles.infoText}>{user.license_plate}</Text>
            </View>
          )}
          {user?.company && (
            <View style={styles.infoRow}>
              <Ionicons name="business" size={20} color="#00d4ff" />
              <Text style={styles.infoText}>{user.company}</Text>
            </View>
          )}
        </View>

        {/* Recent Deliveries */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Livraisons récentes</Text>
          {deliveries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>Aucune livraison récente</Text>
            </View>
          ) : (
            deliveries.map((delivery) => (
              <TouchableOpacity
                key={delivery.id}
                style={styles.deliveryCard}
                onPress={() => {
                  if (delivery.status === 'in_progress' || delivery.status === 'pending') {
                    router.push({
                      pathname: '/driver/navigation',
                      params: {
                        deliveryId: delivery.id,
                        routeId: delivery.route_id,
                        routeName: delivery.route_name,
                      },
                    });
                  }
                }}
              >
                <View style={styles.deliveryHeader}>
                  <Text style={styles.deliveryRoute}>{delivery.route_name || 'Itinéraire'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delivery.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(delivery.status)}</Text>
                  </View>
                </View>
                {delivery.company && (
                  <Text style={styles.deliveryCompany}>{delivery.company}</Text>
                )}
                <Text style={styles.deliveryDate}>
                  {new Date(delivery.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Safety Info */}
        <View style={styles.safetyCard}>
          <Ionicons name="shield-checkmark" size={32} color="#00ff88" />
          <View style={styles.safetyContent}>
            <Text style={styles.safetyTitle}>Rappel sécurité</Text>
            <Text style={styles.safetyText}>
              Respectez les limitations de vitesse sur le site (max 30 km/h)
            </Text>
          </View>
        </View>
      </ScrollView>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  greeting: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  userName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  logoutButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  quickActions: {
    marginTop: 20,
  },
  mainAction: {
    backgroundColor: '#00d4ff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  mainActionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mainActionText: {
    color: '#0a1628',
    fontSize: 20,
    fontWeight: 'bold',
  },
  mainActionSubtext: {
    color: 'rgba(10, 22, 40, 0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  infoText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
    marginTop: 12,
    fontSize: 15,
  },
  deliveryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deliveryRoute: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveryCompany: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  deliveryDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 40,
    gap: 16,
  },
  safetyContent: {
    flex: 1,
  },
  safetyTitle: {
    color: '#00ff88',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  safetyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
});
