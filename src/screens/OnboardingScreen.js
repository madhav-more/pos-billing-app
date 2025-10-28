import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {database} from '../db';
import {isCloudAuthEnabled} from '../services/privacyService';
import {signUp, signIn} from '../services/supabaseAuthService';

export default function OnboardingScreen({navigation, onComplete}) {
  const [mode, setMode] = useState('local'); // 'local' | 'signup' | 'signin'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    companyName: '',
    location: '',
    password: '',
    phone: '',
    gstin: '',
  });

  const handleLocalOnboarding = async () => {
    if (!formData.name || !formData.companyName || !formData.location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await database.write(async () => {
        const settingsCollection = database.collections.get('settings');
        await settingsCollection.create(s => {
          s.key = 'shopName';
          s.value = formData.companyName;
        });
        await settingsCollection.create(s => {
          s.key = 'ownerName';
          s.value = formData.name;
        });
        await settingsCollection.create(s => {
          s.key = 'location';
          s.value = formData.location;
        });
        await settingsCollection.create(s => {
          s.key = 'hasOnboarded';
          s.value = 'true';
        });
      });

      // Trigger App.js to re-check onboarding status
      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert('Error', 'Failed to complete onboarding');
    }
  };

  const handleCloudSignup = async () => {
    const enabled = await isCloudAuthEnabled();
    if (!enabled) {
      Alert.alert('Notice', 'Cloud authentication is disabled by default for privacy.');
      return;
    }

    if (!formData.email || !formData.password || !formData.name) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const result = await signUp(formData.email, formData.password, {
      name: formData.name,
      company_name: formData.companyName,
      location: formData.location,
      phone: formData.phone,
      gstin: formData.gstin,
    });

    if (result.success) {
      await handleLocalOnboarding();
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleCloudSignIn = async () => {
    const enabled = await isCloudAuthEnabled();
    if (!enabled) {
      Alert.alert('Notice', 'Cloud authentication is disabled by default for privacy.');
      return;
    }

    if (!formData.email || !formData.password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    const result = await signIn(formData.email, formData.password);

    if (result.success) {
      // Store user info locally
      await database.write(async () => {
        const settingsCollection = database.collections.get('settings');
        await settingsCollection.create(s => {
          s.key = 'userEmail';
          s.value = formData.email;
        });
        await settingsCollection.create(s => {
          s.key = 'hasOnboarded';
          s.value = 'true';
        });
        await settingsCollection.create(s => {
          s.key = 'authMode';
          s.value = 'cloud';
        });
      });

      if (onComplete) {
        await onComplete();
      }
    } else {
      Alert.alert('Error', result.error);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Welcome to G.U.R.U</Text>

      {mode === 'local' && (
        <>
          <Text style={styles.subtitle}>Create your local profile (Recommended)</Text>

          <TextInput
            style={styles.input}
            placeholder="Your Name *"
            value={formData.name}
            onChangeText={text => setFormData({...formData, name: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Shop Name *"
            value={formData.companyName}
            onChangeText={text => setFormData({...formData, companyName: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="City/Locality *"
            value={formData.location}
            onChangeText={text => setFormData({...formData, location: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone (Optional)"
            value={formData.phone}
            onChangeText={text => setFormData({...formData, phone: text})}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleLocalOnboarding}>
            <Text style={styles.primaryButtonText}>Continue Locally</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('signin')}>
            <Text style={styles.linkText}>Or sign in with cloud account</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'signup' && (
        <>
          <Text style={styles.subtitle}>Create Cloud Account</Text>

          <TextInput
            style={styles.input}
            placeholder="Your Name *"
            value={formData.name}
            onChangeText={text => setFormData({...formData, name: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Email *"
            value={formData.email}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={text => setFormData({...formData, email: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Password *"
            value={formData.password}
            secureTextEntry
            onChangeText={text => setFormData({...formData, password: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Shop Name"
            value={formData.companyName}
            onChangeText={text => setFormData({...formData, companyName: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Location"
            value={formData.location}
            onChangeText={text => setFormData({...formData, location: text})}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleCloudSignup}>
            <Text style={styles.primaryButtonText}>Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('signin')}>
            <Text style={styles.linkText}>Already have an account? Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('local')}>
            <Text style={styles.linkText}>Continue Locally Instead</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'signin' && (
        <>
          <Text style={styles.subtitle}>Sign In to Your Account</Text>

          <TextInput
            style={styles.input}
            placeholder="Email *"
            value={formData.email}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={text => setFormData({...formData, email: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Password *"
            value={formData.password}
            secureTextEntry
            onChangeText={text => setFormData({...formData, password: text})}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleCloudSignIn}>
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('signup')}>
            <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('local')}>
            <Text style={styles.linkText}>Continue Locally Instead</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.privacyNote}>
        Privacy-first: Your data stays on device by default. Cloud features are opt-in only.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop:50
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6B46C1',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#6B46C1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkText: {
    color: '#6B46C1',
    textAlign: 'center',
    marginTop: 16,
  },
  privacyNote: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 32,
    fontStyle: 'italic',
  },
});
