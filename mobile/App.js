import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
  TextInput,
  Modal,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

const DEFAULT_TUNNEL_BASE = 'https://dealerconnect-ai.loca.lt';
const DEFAULT_LAN_BASE = 'http://172.22.121.67:3000';
const FALLBACK_LOCALHOST_BASE = 'http://localhost:3000';

// Configuration presets for the 3 Independent Apps
const APPS_CONFIG = {
  customer: {
    id: 'customer',
    name: 'DealerConnect Customer',
    packageId: 'com.dealerconnectai.customer',
    badge: 'Customer App',
    badgeColor: '#3b82f6',
    initialPath: '/',
    themeColor: '#0f172a',
    accentColor: '#3b82f6',
    subtitle: 'Find products at nearby shops & compare live prices',
    tabs: [
      { key: 'home', label: 'Home', icon: '🏠', path: '/' },
      { key: 'categories', label: 'Categories', icon: '📑', path: '/categories' },
      { key: 'wishlist', label: 'Wishlist', icon: '❤️', path: '/wishlist' },
      { key: 'cart', label: 'Cart', icon: '🛒', path: '/cart' },
      { key: 'profile', label: 'Profile', icon: '👤', path: '/profile' },
    ],
  },
  dealer: {
    id: 'dealer',
    name: 'DealerConnect Dealer',
    packageId: 'com.dealerconnectai.dealer',
    badge: 'Merchant Portal',
    badgeColor: '#10b981',
    initialPath: '/dealer',
    themeColor: '#064e3b',
    accentColor: '#10b981',
    subtitle: 'Shop inventory, pricing & incoming customer leads',
    tabs: [
      { key: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dealer' },
      { key: 'inventory', label: 'Inventory', icon: '📦', path: '/dealer' },
      { key: 'register', label: 'Register', icon: '📝', path: '/dealer/register' },
      { key: 'login', label: 'Sign In', icon: '🔐', path: '/dealer/login' },
      { key: 'leads', label: 'Leads', icon: '💬', path: '/messages' },
    ],
  },
  admin: {
    id: 'admin',
    name: 'DealerConnect Admin',
    packageId: 'com.dealerconnectai.admin',
    badge: 'Admin Console',
    badgeColor: '#8b5cf6',
    initialPath: '/admin',
    themeColor: '#3b0764',
    accentColor: '#8b5cf6',
    subtitle: 'Marketplace control, dealer approvals & catalog',
    tabs: [
      { key: 'overview', label: 'Overview', icon: '📈', path: '/admin' },
      { key: 'dealers', label: 'Approvals', icon: '🛡️', path: '/admin' },
      { key: 'catalog', label: 'Catalog', icon: '📚', path: '/admin' },
      { key: 'categories', label: 'Categories', icon: '🗂️', path: '/admin' },
      { key: 'settings', label: 'Settings', icon: '⚙️', path: '/admin' },
    ],
  },
};

// Mock data for native previews
const CATEGORIES = [
  { id: '1', name: 'Electronics', icon: '📱', color: '#3b82f6' },
  { id: '2', name: 'Appliances', icon: '❄️', color: '#10b981' },
  { id: '3', name: 'Hardware', icon: '🔧', color: '#f59e0b' },
  { id: '4', name: 'Automotive', icon: '🚗', color: '#ef4444' },
  { id: '5', name: 'Fashion', icon: '👕', color: '#8b5cf6' },
  { id: '6', name: 'Home Decor', icon: '🛋️', color: '#ec4899' },
];

const DEALER_INVENTORY_ITEMS = [
  { id: 'inv1', name: 'Samsung Galaxy S25 Ultra 5G', category: 'Electronics', stock: 12, price: '₹1,21,500', status: 'In Stock' },
  { id: 'inv2', name: 'Sony Bravia 55" 4K Smart OLED', category: 'Appliances', stock: 4, price: '₹88,000', status: 'In Stock' },
  { id: 'inv3', name: 'Apple iPhone 16 Pro 256GB', category: 'Electronics', stock: 2, price: '₹1,18,900', status: 'Low Stock' },
];

const ADMIN_PENDING_APPROVALS = [
  { id: 'pen1', shopName: 'Metro Tech Hub', owner: 'Vikram Joshi', city: 'Sector 18', category: 'Electronics', gst: '07AAAAA0000A1Z5' },
  { id: 'pen2', shopName: 'Kaveri Hardware & Paints', owner: 'Ramesh Patel', city: 'Old Market', category: 'Hardware', gst: '27BBBBB1111B2Z4' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  // Read configured variant from Expo extra, default to 'customer'
  const configVariant = Constants.expoConfig?.extra?.appVariant || 'customer';
  const [selectedApp, setSelectedApp] = useState(configVariant in APPS_CONFIG ? configVariant : 'customer');

  const currentApp = APPS_CONFIG[selectedApp];

  const [baseUrl, setBaseUrl] = useState(DEFAULT_TUNNEL_BASE);
  const [inputUrl, setInputUrl] = useState(DEFAULT_TUNNEL_BASE);
  const [activeTab, setActiveTab] = useState(currentApp.tabs[0].key);
  const [currentPath, setCurrentPath] = useState(currentApp.initialPath);
  const [viewMode, setViewMode] = useState('web'); // 'web' or 'native'
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const webViewRef = useRef(null);

  // When switching app target, update path
  useEffect(() => {
    setCurrentPath(APPS_CONFIG[selectedApp].initialPath);
    setActiveTab(APPS_CONFIG[selectedApp].tabs[0].key);
  }, [selectedApp]);

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (viewMode === 'web' && canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [viewMode, canGoBack]);

  const fullUrl = `${baseUrl.replace(/\/$/, '')}${currentPath}`;

  const handleReload = () => {
    setHasError(false);
    setViewMode('web');
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleSaveUrl = () => {
    let clean = inputUrl.trim().replace(/\/$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    setBaseUrl(clean);
    setShowConfigModal(false);
    setHasError(false);
    setViewMode('web');
  };

  const handleTabPress = (tab) => {
    setActiveTab(tab.key);
    setCurrentPath(tab.path);
    setViewMode('web');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ExpoStatusBar style="light" backgroundColor={currentApp.themeColor} />
      <StatusBar barStyle="light-content" backgroundColor={currentApp.themeColor} />

      {/* Top Navigation Bar with Role Identity */}
      <View style={[styles.topBar, { backgroundColor: currentApp.themeColor }]}>
        <View style={styles.brandRow}>
          <View style={[styles.appBadge, { backgroundColor: currentApp.badgeColor }]}>
            <Text style={styles.appBadgeText}>{selectedApp.substring(0, 3).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>{currentApp.name}</Text>
            <Text style={styles.brandPackage}>{currentApp.packageId}</Text>
          </View>
        </View>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={[styles.roleSwitchBtn, { borderColor: currentApp.accentColor }]}
            onPress={() => setShowRoleModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.roleSwitchText}>Switch App ▾</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeToggle, viewMode === 'native' && styles.modeToggleActive]}
            onPress={() => setViewMode(viewMode === 'web' ? 'native' : 'web')}
          >
            <Text style={styles.modeToggleText}>
              {viewMode === 'web' ? '📱 Native' : '🌐 Web'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => {
              setInputUrl(baseUrl);
              setShowConfigModal(true);
            }}
          >
            <Text style={styles.settingsBtnText}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Viewport: Web View or Native Offline Mode */}
      {viewMode === 'web' && !hasError ? (
        <View style={styles.webContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: fullUrl }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            allowsInlineMediaPlayback={true}
            geolocationEnabled={true}
            pullToRefreshEnabled={true}
            nestedScrollEnabled={true}
            scrollEnabled={true}
            overScrollMode="always"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            bounces={true}
            decelerationRate="normal"
            originWhitelist={['*']}
            mixedContentMode="always"
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            applicationNameForUserAgent={`DealerConnect-${selectedApp}/1.0`}
            renderLoading={() => (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={currentApp.accentColor} />
                <Text style={styles.loadingTitle}>Connecting to {currentApp.name}...</Text>
                <Text style={styles.loadingUrl}>{fullUrl}</Text>
                <TouchableOpacity
                  style={styles.openNativeBtn}
                  onPress={() => setViewMode('native')}
                >
                  <Text style={styles.openNativeBtnText}>View Native Dashboard Instead →</Text>
                </TouchableOpacity>
              </View>
            )}
            onNavigationStateChange={(s) => {
              setCanGoBack(s.canGoBack);
            }}
            onError={(e) => {
              console.warn('WebView Error: ', e.nativeEvent);
              setHasError(true);
            }}
          />
        </View>
      ) : (
        /* Native Role-Specific Interface (Works on all networks and offline) */
        <ScrollView style={styles.nativeContainer} contentContainerStyle={styles.nativeContent}>
          {hasError && (
            <View style={styles.alertCard}>
              <Text style={styles.alertCardTitle}>⚠️ Web Server Not Connected</Text>
              <Text style={styles.alertCardMsg}>
                Could not connect to {fullUrl}. Showing Native Standalone Mode.
              </Text>
              <View style={styles.alertCardRow}>
                <TouchableOpacity
                  style={[styles.alertBtnRetry, { backgroundColor: '#3b82f6' }]}
                  onPress={() => {
                    setBaseUrl(DEFAULT_TUNNEL_BASE);
                    setInputUrl(DEFAULT_TUNNEL_BASE);
                    setHasError(false);
                    setViewMode('web');
                  }}
                >
                  <Text style={styles.alertBtnRetryText}>🌐 Use Cloud Tunnel (Any Network)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.alertBtnRetry} onPress={handleReload}>
                  <Text style={styles.alertBtnRetryText}>🔄 Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.alertBtnConfig}
                  onPress={() => setShowConfigModal(true)}
                >
                  <Text style={styles.alertBtnConfigText}>⚙ Change URL</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* RENDER CUSTOMER SCREEN */}
          {selectedApp === 'customer' && (
            <View>
              <View style={styles.nativeHeaderCard}>
                <Text style={styles.nativeAppHeader}>🛍️ Customer Discovery</Text>
                <Text style={styles.nativeAppSub}>Find in-stock products at verified neighborhood shops</Text>
              </View>

              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search mobiles, TVs, appliances..."
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <Text style={styles.sectionTitle}>Shop by Categories</Text>
              <View style={styles.categoriesRow}>
                {CATEGORIES.map((c) => (
                  <View key={c.id} style={styles.catPill}>
                    <Text style={styles.catPillIcon}>{c.icon}</Text>
                    <Text style={styles.catPillName}>{c.name}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Live Price Comparison (Nearby)</Text>
              <View style={styles.card}>
                <Text style={styles.cardHeader}>Samsung Galaxy S25 Ultra 5G</Text>
                <Text style={styles.cardPriceBest}>Best Local Price: ₹1,21,500</Text>
                <Text style={styles.cardPriceOnline}>Online MRP: ₹1,29,999 (Save ₹8,499)</Text>
                <Text style={styles.cardBadgeGreen}>📍 3 shops carry this in your PIN code</Text>
              </View>
            </View>
          )}

          {/* RENDER DEALER SCREEN */}
          {selectedApp === 'dealer' && (
            <View>
              <View style={[styles.nativeHeaderCard, { borderColor: '#10b981' }]}>
                <Text style={[styles.nativeAppHeader, { color: '#10b981' }]}>🏪 Merchant Management</Text>
                <Text style={styles.nativeAppSub}>Manage your shop catalog, stock levels & customer leads</Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#10b981',
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    marginTop: 10,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    handleTabPress({ path: '/dealer/register' });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>
                    📝 Open Dealership Registration Form →
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>18</Text>
                  <Text style={styles.statLbl}>Active Products</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: '#10b981' }]}>7</Text>
                  <Text style={styles.statLbl}>New Leads</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: '#f59e0b' }]}>2</Text>
                  <Text style={styles.statLbl}>Low Stock</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>My Shop Inventory</Text>
              {DEALER_INVENTORY_ITEMS.map((item) => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.invRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardHeader}>{item.name}</Text>
                      <Text style={styles.cardSub}>{item.category} · Stock: {item.stock} units</Text>
                    </View>
                    <Text style={styles.cardPriceBest}>{item.price}</Text>
                  </View>
                  <View style={styles.invActionRow}>
                    <Text style={[styles.statusTag, item.status === 'Low Stock' && styles.statusTagLow]}>
                      ● {item.status}
                    </Text>
                    <TouchableOpacity style={styles.invEditBtn}>
                      <Text style={styles.invEditBtnText}>Edit Price/Stock</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* RENDER ADMIN SCREEN */}
          {selectedApp === 'admin' && (
            <View>
              <View style={[styles.nativeHeaderCard, { borderColor: '#8b5cf6' }]}>
                <Text style={[styles.nativeAppHeader, { color: '#8b5cf6' }]}>🛡️ Marketplace Admin Console</Text>
                <Text style={styles.nativeAppSub}>Platform supervision, dealer approvals & master catalog</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>3</Text>
                  <Text style={styles.statLbl}>Pending Approvals</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: '#8b5cf6' }]}>142</Text>
                  <Text style={styles.statLbl}>Approved Dealers</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: '#10b981' }]}>1,240</Text>
                  <Text style={styles.statLbl}>Master SKUs</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Pending Dealer Approvals</Text>
              {ADMIN_PENDING_APPROVALS.map((dealer) => (
                <View key={dealer.id} style={styles.card}>
                  <Text style={styles.cardHeader}>{dealer.shopName}</Text>
                  <Text style={styles.cardSub}>Owner: {dealer.owner} · {dealer.city}</Text>
                  <Text style={styles.cardSub}>GST: {dealer.gst}</Text>
                  <View style={styles.adminActionRow}>
                    <TouchableOpacity
                      style={styles.adminRejectBtn}
                      onPress={() => Alert.alert('Dealer Rejected')}
                    >
                      <Text style={styles.adminRejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.adminApproveBtn}
                      onPress={() => Alert.alert('Dealer Approved')}
                    >
                      <Text style={styles.adminApproveBtnText}>✓ Approve Dealer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Role-Specific Bottom Navigation Bar */}
      <View style={[styles.bottomBar, { backgroundColor: currentApp.themeColor }]}>
        {currentApp.tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.bottomTab}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomTabIcon}>{tab.icon}</Text>
              <Text
                style={[
                  styles.bottomTabLabel,
                  isActive && { color: currentApp.accentColor, fontWeight: '700' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Role Selector Modal */}
      <Modal
        visible={showRoleModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Application Experience</Text>
            <Text style={styles.modalSub}>
              Switch between the three separately installable applications:
            </Text>

            {Object.keys(APPS_CONFIG).map((key) => {
              const app = APPS_CONFIG[key];
              const isSelected = selectedApp === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.roleSelectCard, isSelected && { borderColor: app.accentColor }]}
                  onPress={() => {
                    setSelectedApp(key);
                    setShowRoleModal(false);
                    setHasError(false);
                    setViewMode('web');
                  }}
                >
                  <View style={[styles.roleSelectBadge, { backgroundColor: app.badgeColor }]}>
                    <Text style={styles.roleSelectBadgeText}>{key.substring(0, 3).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleSelectTitle}>{app.name}</Text>
                    <Text style={styles.roleSelectSub}>{app.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowRoleModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Server IP Config Modal */}
      <Modal
        visible={showConfigModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connect Server Instance</Text>
            <Text style={styles.modalSub}>
              Set the backend Next.js development server URL:
            </Text>

            <TextInput
              style={styles.modalInput}
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="http://192.168.1.5:3000"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.presetSection}>
              <Text style={styles.presetLabel}>Quick Presets:</Text>
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={[styles.presetChip, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}
                  onPress={() => setInputUrl(DEFAULT_TUNNEL_BASE)}
                >
                  <Text style={[styles.presetChipText, { color: '#1d4ed8', fontWeight: 'bold' }]}>🌐 Cloud Tunnel (Any Network)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setInputUrl(DEFAULT_LAN_BASE)}
                >
                  <Text style={styles.presetChipText}>🏠 Local Wi-Fi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setInputUrl(FALLBACK_LOCALHOST_BASE)}
                >
                  <Text style={styles.presetChipText}>💻 localhost</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setShowConfigModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSave, { backgroundColor: currentApp.accentColor }]}
                onPress={handleSaveUrl}
              >
                <Text style={styles.modalBtnSaveText}>Connect →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topBar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  appBadgeText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
  },
  brandTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  brandPackage: {
    color: '#94a3b8',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleSwitchBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  roleSwitchText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  modeToggle: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeToggleActive: {
    backgroundColor: '#3b82f6',
  },
  modeToggleText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
  },
  settingsBtn: {
    backgroundColor: '#1e293b',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  settingsBtnText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  webView: {
    flex: 1,
  },
  loadingBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
  },
  loadingUrl: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  openNativeBtn: {
    marginTop: 20,
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  openNativeBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  nativeContainer: {
    flex: 1,
    backgroundColor: '#0b1120',
  },
  nativeContent: {
    padding: 16,
    paddingBottom: 24,
  },
  nativeHeaderCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  nativeAppHeader: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  nativeAppSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 3,
  },
  alertCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  alertCardTitle: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
  },
  alertCardMsg: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 3,
  },
  alertCardRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  alertBtnRetry: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  alertBtnRetryText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  alertBtnConfig: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  alertBtnConfigText: {
    color: '#f8fafc',
    fontSize: 11,
  },
  searchBar: {
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  catPill: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  catPillIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  catPillName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  cardSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 3,
  },
  cardPriceBest: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  cardPriceOnline: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  cardBadgeGreen: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statVal: {
    color: '#38bdf8',
    fontSize: 20,
    fontWeight: '800',
  },
  statLbl: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  invRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  statusTag: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
  },
  statusTagLow: {
    color: '#f59e0b',
  },
  invEditBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  invEditBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
  },
  adminActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  adminRejectBtn: {
    backgroundColor: '#ef444420',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  adminRejectBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  adminApproveBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  adminApproveBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  bottomTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  bottomTabIcon: {
    fontSize: 17,
  },
  bottomTabLabel: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 16,
  },
  roleSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  roleSelectBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSelectBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  roleSelectTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  roleSelectSub: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  modalCloseBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCloseBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    marginBottom: 14,
  },
  presetSection: {
    marginBottom: 16,
  },
  presetLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipText: {
    color: '#38bdf8',
    fontSize: 11,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtnCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalBtnCancelText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalBtnSave: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalBtnSaveText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
