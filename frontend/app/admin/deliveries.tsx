import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';

const { width } = Dimensions.get('window');

export default function AdminDeliveries() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  
  const [newDelivery, setNewDelivery] = useState({
    route_id: '',
    company: '',
    notes: '',
    vehicle_type: 'truck',
  });

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      const [deliveriesRes, routesRes] = await Promise.all([
        api.get(`/deliveries${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/routes'),
      ]);
      setDeliveries(deliveriesRes.data);
      setRoutes(routesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleCreateDelivery = async () => {
    if (!newDelivery.route_id) {
      Alert.alert('Erreur', 'Veuillez sélectionner un itinéraire');
      return;
    }

    try {
      const response = await api.post('/deliveries', newDelivery);
      setDeliveries([response.data, ...deliveries]);
      setShowCreateModal(false);
      setNewDelivery({ route_id: '', company: '', notes: '', vehicle_type: 'truck' });
      
      // Show QR code
      setSelectedDelivery(response.data);
      setShowQRModal(true);
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de créer la livraison');
    }
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

  const statusFilters = [
    { key: null, label: 'Toutes' },
    { key: 'pending', label: 'En attente' },
    { key: 'in_progress', label: 'En cours' },
    { key: 'completed', label: 'Terminées' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des Livraisons</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#0a1628" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {statusFilters.map((filter) => (
          <TouchableOpacity
            key={filter.key || 'all'}
            style={[
              styles.filterChip,
              filterStatus === filter.key && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus(filter.key)}
          >
            <Text
              style={[
                styles.filterText,
                filterStatus === filter.key && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Deliveries List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#00d4ff" />
        }
      >
        {deliveries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#444" />
            <Text style={styles.emptyText}>Aucune livraison</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.emptyButtonText}>Créer une livraison</Text>
            </TouchableOpacity>
          </View>
        ) : (
          deliveries.map((delivery) => (
            <TouchableOpacity
              key={delivery.id}
              style={styles.deliveryCard}
              onPress={() => {
                setSelectedDelivery(delivery);
                setShowQRModal(true);
              }}
            >
              <View style={styles.deliveryHeader}>
                <View style={styles.deliveryInfo}>
                  <Text style={styles.deliveryRoute}>
                    {delivery.route_name || 'Itinéraire'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delivery.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(delivery.status)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={() => {
                    setSelectedDelivery(delivery);
                    setShowQRModal(true);
                  }}
                >
                  <Ionicons name="qr-code" size={24} color="#00d4ff" />
                </TouchableOpacity>
              </View>

              {delivery.company && (
                <View style={styles.detailRow}>
                  <Ionicons name="business-outline" size={16} color="#888" />
                  <Text style={styles.detailText}>{delivery.company}</Text>
                </View>
              )}

              {delivery.driver_name && (
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={16} color="#888" />
                  <Text style={styles.detailText}>{delivery.driver_name}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#888" />
                <Text style={styles.detailText}>
                  {new Date(delivery.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              {delivery.vehicle_type && (
                <View style={styles.vehicleBadge}>
                  <Ionicons
                    name={delivery.vehicle_type === 'truck' ? 'bus' : delivery.vehicle_type === 'van' ? 'car-sport' : 'car'}
                    size={14}
                    color="#00d4ff"
                  />
                  <Text style={styles.vehicleText}>
                    {delivery.vehicle_type === 'truck' ? 'Camion' :
                     delivery.vehicle_type === 'van' ? 'Camionnette' : 'VL'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create Delivery Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle livraison</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Route Selection */}
              <Text style={styles.inputLabel}>Itinéraire *</Text>
              <View style={styles.routesGrid}>
                {routes.map((route) => (
                  <TouchableOpacity
                    key={route.id}
                    style={[
                      styles.routeOption,
                      newDelivery.route_id === route.id && styles.routeOptionActive,
                    ]}
                    onPress={() => setNewDelivery({ ...newDelivery, route_id: route.id })}
                  >
                    <Ionicons
                      name="navigate"
                      size={20}
                      color={newDelivery.route_id === route.id ? '#00d4ff' : '#888'}
                    />
                    <Text
                      style={[
                        styles.routeOptionText,
                        newDelivery.route_id === route.id && styles.routeOptionTextActive,
                      ]}
                    >
                      {route.name}
                    </Text>
                    <Text style={styles.routeDistance}>{route.distance} km</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Company */}
              <Text style={styles.inputLabel}>Entreprise</Text>
              <TextInput
                style={styles.input}
                placeholder="Nom de l'entreprise"
                placeholderTextColor="#666"
                value={newDelivery.company}
                onChangeText={(text) => setNewDelivery({ ...newDelivery, company: text })}
              />

              {/* Vehicle Type */}
              <Text style={styles.inputLabel}>Type de véhicule</Text>
              <View style={styles.vehicleOptions}>
                {[
                  { id: 'truck', label: 'Camion', icon: 'bus' },
                  { id: 'van', label: 'Camionnette', icon: 'car-sport' },
                  { id: 'car', label: 'VL', icon: 'car' },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.vehicleOption,
                      newDelivery.vehicle_type === type.id && styles.vehicleOptionActive,
                    ]}
                    onPress={() => setNewDelivery({ ...newDelivery, vehicle_type: type.id })}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={24}
                      color={newDelivery.vehicle_type === type.id ? '#00d4ff' : '#888'}
                    />
                    <Text
                      style={[
                        styles.vehicleOptionText,
                        newDelivery.vehicle_type === type.id && styles.vehicleOptionTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes */}
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Instructions spéciales..."
                placeholderTextColor="#666"
                value={newDelivery.notes}
                onChangeText={(text) => setNewDelivery({ ...newDelivery, notes: text })}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <TouchableOpacity style={styles.createButton} onPress={handleCreateDelivery}>
              <Ionicons name="add-circle" size={22} color="#0a1628" />
              <Text style={styles.createButtonText}>Créer et générer QR Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal visible={showQRModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>QR Code Livraison</Text>
              <TouchableOpacity onPress={() => setShowQRModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedDelivery && (
              <View style={styles.qrContainer}>
                <View style={styles.qrCodeWrapper}>
                  {selectedDelivery.qr_code ? (
                    <Image
                      source={{ uri: `data:image/png;base64,${selectedDelivery.qr_code}` }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <Ionicons name="qr-code" size={100} color="#00d4ff" />
                    </View>
                  )}
                </View>

                <Text style={styles.qrRoute}>{selectedDelivery.route_name}</Text>
                {selectedDelivery.company && (
                  <Text style={styles.qrCompany}>{selectedDelivery.company}</Text>
                )}

                <View style={styles.qrInfo}>
                  <Text style={styles.qrInfoText}>ID: {selectedDelivery.id.slice(0, 8)}...</Text>
                  <Text style={styles.qrInfoText}>
                    Créé: {new Date(selectedDelivery.created_at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.printButton}
                  onPress={() => Alert.alert('Impression', 'Fonctionnalité d\'impression')}
                >
                  <Ionicons name="print" size={20} color="#fff" />
                  <Text style={styles.printButtonText}>Imprimer QR Code</Text>
                </TouchableOpacity>
              </View>
            )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    maxHeight: 56,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#00d4ff',
  },
  filterText: {
    color: '#888',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#0a1628',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    marginTop: 16,
  },
  emptyButton: {
    backgroundColor: '#00d4ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#0a1628',
    fontWeight: '600',
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryRoute: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  qrButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  detailText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  vehicleText: {
    color: '#00d4ff',
    fontSize: 12,
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
    maxHeight: '85%',
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
  modalBody: {
    maxHeight: 400,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  routesGrid: {
    gap: 10,
  },
  routeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  routeOptionActive: {
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  routeOptionText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  routeOptionTextActive: {
    color: '#00d4ff',
  },
  routeDistance: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  vehicleOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  vehicleOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  vehicleOptionActive: {
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  vehicleOptionText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  vehicleOptionTextActive: {
    color: '#00d4ff',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00d4ff',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  createButtonText: {
    color: '#0a1628',
    fontSize: 16,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrCodeWrapper: {
    width: 220,
    height: 220,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  qrRoute: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  qrCompany: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  qrInfo: {
    marginTop: 16,
    alignItems: 'center',
  },
  qrInfoText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00d4ff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  printButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
