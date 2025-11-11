import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import simpleAuthService from '../services/simpleAuthService';

export default function SimpleLoginScreen({onLoginComplete}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGetStarted = async () => {
    // Validate required fields
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }

    if (!companyName.trim()) {
      Alert.alert('Required', 'Please enter your shop/business name');
      return;
    }

    setIsLoading(true);

    try {
      const result = await simpleAuthService.createUserProfile({
        name: name.trim(),
        email: email.trim(),
        companyName: companyName.trim(),
        location: location.trim(),
      });

      if (result.success) {
        console.log('✅ Profile created successfully');
        if (onLoginComplete) {
          onLoginComplete();
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to create profile');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient
        colors={['#6B46C1', '#8B5CF6', '#A78BFA']}
        style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>G.U.R.U</Text>
            </View>
            <Text style={styles.title}>Point of Sale</Text>
            <Text style={styles.subtitle}>
              Your offline-first billing solution
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Get Started</Text>
            <Text style={styles.cardSubtitle}>
              Create your profile to begin
            </Text>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            {/* Company Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Shop/Business Name *</Text>
              <TextInput
                style={styles.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="e.g., My Store"
                placeholderTextColor="#999"
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email (Optional)</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            {/* Location Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location (Optional)</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="City, State"
                placeholderTextColor="#999"
                editable={!isLoading}
              />
            </View>

            {/* Get Started Button */}
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleGetStarted}
              disabled={isLoading}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#6B46C1', '#8B5CF6']}
                style={styles.buttonGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}>
                <Text style={styles.buttonText}>
                  {isLoading ? 'Creating Profile...' : 'Get Started →'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Privacy Note */}
            <View style={styles.privacyNote}>
              <Text style={styles.privacyText}>🔒 Your data stays private</Text>
              <Text style={styles.privacySubtext}>
                All information is stored locally on your device
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              No login required • Works offline • Privacy first
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  privacyNote: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6B46C1',
  },
  privacyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  privacySubtext: {
    fontSize: 12,
    color: '#666',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
});
