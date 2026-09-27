import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../../components/ui/header';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../lib/store/cart';

import type { User } from '@supabase/supabase-js';

export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const cartCount = useCartStore((state) => state.getItemCount());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string>('');

  useEffect(() => {
    const fetchUser = async (): Promise<void> => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);
        if (authUser) {
          // Try to get full_name from user metadata or profile
          const name = authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? '';
          setProfileName(name);
        }
      } catch {
        // Not authenticated
      } finally {
        setLoading(false);
      }
    };
    fetchUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const name = session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? '';
        setProfileName(name);
      } else {
        setProfileName('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    } else {
      setUser(null);
      setProfileName('');
    }
  }, []);

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  // Not authenticated — show login/signup prompt
  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header title="ACCOUNT" showBack={false} showSearch={false} bagCount={cartCount} />
        <View style={styles.authPrompt}>
          <View style={styles.authIconCircle}>
            <Ionicons name="person-outline" size={36} color="#A1A1AA" />
          </View>
          <Text style={styles.authTitle}>Welcome to ROOT</Text>
          <Text style={styles.authSubtitle}>
            Sign in to track orders, save favorites, and access exclusive member perks.
          </Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.authButtonText}>SIGN IN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.authOutlineButton}
            onPress={() => router.push('/auth/signup')}
            activeOpacity={0.85}
          >
            <Text style={styles.authOutlineButtonText}>CREATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="ACCOUNT" showBack={false} showSearch={false} bagCount={cartCount} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile User Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials(profileName)}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.userName}>{profileName || 'Member'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
            <View style={styles.memberBadge}>
              <Ionicons name="sparkles" size={10} color="#047857" />
              <Text style={styles.memberBadgeText}>ROOT MEMBER</Text>
            </View>
          </View>
        </View>

        {/* Navigation Menu Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES & SUPPORT</Text>

          <View style={styles.menuGroup}>
            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="cube-outline" size={20} color="#18181B" />
                <Text style={styles.menuItemText}>Order History & Tracking</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="location-outline" size={20} color="#18181B" />
                <Text style={styles.menuItemText}>Domestic Address Book</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="card-outline" size={20} color="#18181B" />
                <Text style={styles.menuItemText}>Saved Payment Methods</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="help-buoy-outline" size={20} color="#18181B" />
                <Text style={styles.menuItemText}>Customer Care & Returns</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} style={[styles.menuItem, styles.menuItemLast]}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#18181B" />
                <Text style={styles.menuItemText}>Privacy & Terms</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Monorepo Branding */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>ROOT</Text>
          <Text style={styles.footerVersion}>Mobile Version 1.0.0 (Expo SDK 52)</Text>
          <Text style={styles.footerCopyright}>
            Direct Domestic Partner Network • All Rights Reserved
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { paddingBottom: 40 },
  authPrompt: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  authIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F4F4F5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  authTitle: { fontSize: 22, fontWeight: '700', color: '#18181B', marginBottom: 8 },
  authSubtitle: {
    fontSize: 14, color: '#71717A', textAlign: 'center', lineHeight: 20, marginBottom: 28,
  },
  authButton: {
    height: 50, width: '100%', backgroundColor: '#18181B', borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  authButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },
  authOutlineButton: {
    height: 50, width: '100%', borderWidth: 1, borderColor: '#18181B', borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  authOutlineButtonText: { color: '#18181B', fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 20,
    backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  avatarCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#18181B',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1 },
  profileMeta: { marginLeft: 16, flex: 1 },
  userName: { fontSize: 17, fontWeight: '700', color: '#18181B', letterSpacing: -0.3 },
  userEmail: { fontSize: 12, color: '#71717A', marginTop: 2 },
  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12, alignSelf: 'flex-start', marginTop: 6,
  },
  memberBadgeText: { fontSize: 9, fontWeight: '700', color: '#047857', letterSpacing: 0.5 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#71717A', marginBottom: 8,
  },
  menuGroup: {
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1,
    borderColor: '#E4E4E7', overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F4F4F5',
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemText: { fontSize: 14, color: '#18181B', fontWeight: '500' },
  signOutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, backgroundColor: '#FFFFFF', borderRadius: 10,
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  footer: { alignItems: 'center', marginTop: 36, paddingBottom: 20 },
  footerLogo: { fontSize: 16, fontWeight: '900', letterSpacing: 4, color: '#A1A1AA', marginBottom: 4 },
  footerVersion: { fontSize: 11, color: '#A1A1AA', marginBottom: 2 },
  footerCopyright: { fontSize: 10, color: '#D4D4D8' },
});
