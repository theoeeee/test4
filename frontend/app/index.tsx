import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';

const { width } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Auto-redirect if logged in
    if (user) {
      if (user.role === 'admin' || user.role === 'supervisor') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/driver/home');
      }
    }
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="location" size={60} color="#00d4ff" />
          </View>
          <Text style={styles.title}>SiteTrack</Text>
          <Text style={styles.subtitle}>Suivi de Livreurs sur Site Industriel</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <View style={styles.feature}>
              <Ionicons name="qr-code" size={28} color="#00d4ff" />
              <Text style={styles.featureText}>Scan QR</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="navigate" size={28} color="#00d4ff" />
              <Text style={styles.featureText}>Navigation GPS</Text>
            </View>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.feature}>
              <Ionicons name="shield-checkmark" size={28} color="#00d4ff" />
              <Text style={styles.featureText}>Sécurité</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="analytics" size={28} color="#00d4ff" />
              <Text style={styles.featureText}>Suivi Temps Réel</Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/auth/login')}
          >
            <Ionicons name="log-in-outline" size={24} color="#fff" />
            <Text style={styles.primaryButtonText}>Connexion</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/register')}
          >
            <Ionicons name="person-add-outline" size={24} color="#00d4ff" />
            <Text style={styles.secondaryButtonText}>Créer un compte</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push('/driver/scan')}
          >
            <Ionicons name="qr-code-outline" size={24} color="#fff" />
            <Text style={styles.scanButtonText}>Scanner QR Code (Accès Rapide)</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>Version 1.0 - Site Industriel Demo</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  featuresContainer: {
    marginVertical: 30,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  feature: {
    alignItems: 'center',
    width: width * 0.35,
  },
  featureText: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    fontSize: 14,
  },
  buttonsContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#00d4ff',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00d4ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryButtonText: {
    color: '#00d4ff',
    fontSize: 18,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#1a3a5c',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 20,
  },
});
