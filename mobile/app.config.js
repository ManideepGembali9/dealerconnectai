module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || 'customer';

  const variants = {
    customer: {
      name: 'DealerConnect Customer',
      slug: 'dealerconnect-customer',
      scheme: 'dealerconnect-customer',
      package: 'com.dealerconnectai.customer',
      bundleIdentifier: 'com.dealerconnectai.customer',
      initialRoute: '/',
      role: 'customer',
      primaryColor: '#3b82f6',
      badge: 'Customer App',
      description: 'Discover nearby products and local shops with live price comparison.',
    },
    dealer: {
      name: 'DealerConnect Dealer',
      slug: 'dealerconnect-dealer',
      scheme: 'dealerconnect-dealer',
      package: 'com.dealerconnectai.dealer',
      bundleIdentifier: 'com.dealerconnectai.dealer',
      initialRoute: '/dealer',
      role: 'dealer',
      primaryColor: '#10b981',
      badge: 'Dealer Portal',
      description: 'Shop profile, catalog quick-add, stock & pricing, and customer enquiries.',
    },
    admin: {
      name: 'DealerConnect Admin',
      slug: 'dealerconnect-admin',
      scheme: 'dealerconnect-admin',
      package: 'com.dealerconnectai.admin',
      bundleIdentifier: 'com.dealerconnectai.admin',
      initialRoute: '/admin',
      role: 'admin',
      primaryColor: '#8b5cf6',
      badge: 'Admin Console',
      description: 'Marketplace operations, dealer approvals, master catalog, and branding.',
    },
  };

  const selected = variants[variant] || variants.customer;

  return {
    name: selected.name,
    slug: selected.slug,
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: selected.scheme,
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0f172a',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: selected.bundleIdentifier,
      infoPlist: {
        NSCameraUsageDescription: 'DealerConnect requires camera access to capture product photos.',
        NSLocationWhenInUseUsageDescription: 'DealerConnect uses your location to discover nearby shops and check product availability.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      package: selected.package,
      usesCleartextTraffic: true,
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'CAMERA',
        'INTERNET',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      appVariant: variant,
      appRole: selected.role,
      appName: selected.name,
      initialRoute: selected.initialRoute,
      primaryColor: selected.primaryColor,
      badge: selected.badge,
      description: selected.description,
    },
  };
};
