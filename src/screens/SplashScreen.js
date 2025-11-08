import React from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>G.U.R.U</Text>
      <Text style={styles.tagline}>Grocery Utility & Record Updater</Text>
      <ActivityIndicator size="large" color="#6B46C1" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#E9D8FD',
    marginTop: 8,
  },
  loader: {
    marginTop: 32,
  },
});
