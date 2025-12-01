import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
    vehicle_type: 'truck',
    license_plate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'driver' | 'admin'>('driver');

  const vehicleTypes = [
    { id: 'truck', label: 'Camion', icon: 'bus' },
    { id: 'van', label: 'Camionnette', icon: 'car-sport' },
    { id: 'car', label: 'Véhicule Léger', icon: 'car' },
  ];

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      Alert.alert('Erreur', 'Veuillez remplir les champs obligatoires');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        ...formData,
        role: selectedRole,
        email: formData.email.toLowerCase().trim(),
      });
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>Rejoignez SiteTrack</Text>
          </View>

          {/* Role Selection */}
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[styles.roleButton, selectedRole === 'driver' && styles.roleButtonActive]}
              onPress={() => setSelectedRole('driver')}
            >
              <Ionicons name="car" size={24} color={selectedRole === 'driver' ? '#fff' : '#00d4ff'} />
              <Text style={[styles.roleText, selectedRole === 'driver' && styles.roleTextActive]}>
                Livreur
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleButton, selectedRole === 'admin' && styles.roleButtonActive]}
              onPress={() => setSelectedRole('admin')}
            >
              <Ionicons name="settings" size={24} color={selectedRole === 'admin' ? '#fff' : '#00d4ff'} />
              <Text style={[styles.roleText, selectedRole === 'admin' && styles.roleTextActive]}>
                Admin
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={22} color="#00d4ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nom complet *"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={22} color="#00d4ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email *"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={22} color="#00d4ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe *"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={22} color="#00d4ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Téléphone"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="business-outline" size={22} color="#00d4ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Entreprise"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={formData.company}
                onChangeText={(text) => setFormData({ ...formData, company: text })}
              />
            </View>

            {selectedRole === 'driver' && (
              <>
                {/* Vehicle Type */}
                <Text style={styles.sectionLabel}>Type de véhicule</Text>
                <View style={styles.vehicleContainer}>
                  {vehicleTypes.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.vehicleButton,
                        formData.vehicle_type === type.id && styles.vehicleButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, vehicle_type: type.id })}
                    >
                      <Ionicons
                        name={type.icon as any}
                        size={24}
                        color={formData.vehicle_type === type.id ? '#fff' : '#00d4ff'}
                      />
                      <Text
                        style={[
                          styles.vehicleText,
                          formData.vehicle_type === type.id && styles.vehicleTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="card-outline" size={22} color="#00d4ff" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Plaque d'immatriculation"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={formData.license_plate}
                    onChangeText={(text) => setFormData({ ...formData, license_plate: text.toUpperCase() })}
                    autoCapitalize="characters"
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={22} color="#fff" />
                  <Text style={styles.registerButtonText}>Créer mon compte</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginLink}>
                Déjà un compte ? <Text style={styles.loginLinkBold}>Se connecter</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    marginTop: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  header: {
    marginTop: 10,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00d4ff',
    backgroundColor: 'transparent',
  },
  roleButtonActive: {
    backgroundColor: '#00d4ff',
  },
  roleText: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#fff',
  },
  form: {
    gap: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#fff',
    fontSize: 16,
  },
  sectionLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  vehicleContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  vehicleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.5)',
    backgroundColor: 'transparent',
  },
  vehicleButtonActive: {
    backgroundColor: '#00d4ff',
    borderColor: '#00d4ff',
  },
  vehicleText: {
    color: '#00d4ff',
    fontSize: 12,
    marginTop: 4,
  },
  vehicleTextActive: {
    color: '#fff',
  },
  registerButton: {
    backgroundColor: '#00d4ff',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginLink: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 15,
  },
  loginLinkBold: {
    color: '#00d4ff',
    fontWeight: '600',
  },
});
