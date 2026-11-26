/**
 * Device & Environment Information Utility
 * Captures browser, OS, device type, phone/device model, brand, viewport, and screen resolution for GA4 analytics.
 */

export interface DeviceInfo {
  device_type: 'Desktop' | 'Tablet' | 'Mobile'
  device_model: string
  device_brand: string
  phone_model: string
  browser: string
  os: string
  viewport: string
  screen_resolution: string
  language: string
  timezone: string
}

// In-memory cache for high-entropy client hints (e.g. navigator.userAgentData)
let cachedHighEntropyModel: string | null = null

/**
 * Initialize high-entropy User-Agent Client Hints if supported (Chromium, Edge, Samsung Internet, Android).
 */
if (typeof navigator !== 'undefined' && 'userAgentData' in navigator) {
  const uaData = (navigator as any).userAgentData
  if (uaData && typeof uaData.getHighEntropyValues === 'function') {
    uaData
      .getHighEntropyValues(['model', 'platform', 'platformVersion'])
      .then((hints: { model?: string }) => {
        if (hints && hints.model) {
          cachedHighEntropyModel = hints.model.trim()
        }
      })
      .catch(() => {
        // Silently ignore if client hints permission is restricted
      })
  }
}

/**
 * Detects specific iPhone/iPad models using screen resolution, pixel ratio, and WebGL GPU details.
 */
function getAppleDeviceModel(): string {
  if (typeof window === 'undefined') return 'Apple Device'

  const ua = navigator.userAgent || ''
  const isIPad =
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isIPhone = /iPhone/i.test(ua)
  const isIPod = /iPod/i.test(ua)

  if (isIPod) return 'iPod Touch'

  if (isIPad) {
    const w = Math.min(window.screen.width, window.screen.height)
    const h = Math.max(window.screen.width, window.screen.height)
    const dpr = window.devicePixelRatio || 1

    if (w === 1024 && h === 1366) return 'iPad Pro 12.9"'
    if (w === 834 && (h === 1194 || h === 1210)) return 'iPad Pro 11"'
    if (w === 834 && h === 1112) return 'iPad Air / Pro 10.5"'
    if (w === 820 && h === 1180) return 'iPad Air / iPad 10th Gen'
    if (w === 810 && h === 1080) return 'iPad 10.2"'
    if (w === 768 && h === 1024)
      return dpr === 2 ? 'iPad Mini / Air 9.7"' : 'iPad'
    return 'iPad'
  }

  if (isIPhone) {
    const w = Math.min(window.screen.width, window.screen.height)
    const h = Math.max(window.screen.width, window.screen.height)
    const dpr = window.devicePixelRatio || 1

    // iPhone Screen Specifications mapping:
    // iPhone 16 Pro Max
    if (w === 440 && h === 956) return 'iPhone 16 Pro Max'
    // iPhone 16 Pro
    if (w === 402 && h === 874) return 'iPhone 16 Pro'
    // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
    if (w === 430 && h === 932 && dpr >= 3)
      return 'iPhone 14 Pro Max / 15 Pro Max / 16 Plus'
    // iPhone 14 Pro, 15, 15 Pro, 16
    if (w === 393 && h === 852 && dpr >= 3)
      return 'iPhone 14 Pro / 15 / 15 Pro / 16'
    // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
    if (w === 428 && h === 926 && dpr >= 3)
      return 'iPhone 12/13 Pro Max / 14 Plus'
    // iPhone 12, 12 Pro, 13, 13 Pro, 14
    if (w === 390 && h === 844 && dpr >= 3) return 'iPhone 12 / 13 / 14'
    // iPhone X, XS, 11 Pro, 12 mini, 13 mini
    if (w === 375 && h === 812 && dpr >= 3) {
      return h === 812 && w === 375
        ? 'iPhone X / XS / 11 Pro / 12-13 Mini'
        : 'iPhone'
    }
    // iPhone XS Max, 11 Pro Max
    if (w === 414 && h === 896 && dpr >= 3) return 'iPhone XS Max / 11 Pro Max'
    // iPhone XR, 11
    if (w === 414 && h === 896 && dpr === 2) return 'iPhone XR / 11'
    // iPhone 6 Plus, 7 Plus, 8 Plus
    if (w === 414 && h === 736 && dpr >= 3) return 'iPhone 6+/7+/8+ Plus'
    // iPhone 6, 6s, 7, 8, SE (2nd & 3rd gen)
    if (w === 375 && h === 667 && dpr === 2) return 'iPhone 6/7/8/SE'
    // iPhone 5, 5s, 5c, SE 1st gen
    if (w === 320 && h === 568 && dpr === 2) return 'iPhone 5/5s/SE (1st Gen)'

    return 'iPhone'
  }

  return 'Apple Device'
}

/**
 * Extracts Android device phone model from user-agent string.
 */
function extractAndroidModel(ua: string): string | null {
  // Pattern 1: Android ...; <Model> Build/... or Android ...; <Model>)
  const match = ua.match(
    /Android\s+[\d.]+;\s*([^;()]+?)(?:\s+Build|\s*;\s*wv|\s*\))/i
  )
  if (match && match[1]) {
    const raw = match[1].trim()
    // Filter out generic strings or OS tokens
    if (
      raw &&
      !/^(Mobile|K|Linux|Android|Release|Version)$/i.test(raw) &&
      raw.length > 1 &&
      raw.length < 50
    ) {
      return raw
    }
  }

  // Pattern 2: Specific common prefixes (Samsung, Tecno, Infinix, Xiaomi, etc.)
  const brandMatch = ua.match(
    /\b(SM-[A-Z0-9]+|GT-[A-Z0-9]+|Infinix\s+[A-Z0-9]+|TECNO\s+[A-Z0-9]+|Redmi\s+[^;)]+|POCO\s+[^;)]+|Pixel\s+\d[a-zA-Z0-9\s]*|CPH\d{4}|RMX\d{4}|V\d{4}[A-Z0-9]*)\b/i
  )
  if (brandMatch && brandMatch[1]) {
    return brandMatch[1].trim()
  }

  return null
}

/**
 * Infer phone brand from model name or user agent.
 */
function detectBrand(model: string, ua: string): string {
  const combined = `${model} ${ua}`.toLowerCase()

  if (/iphone|ipad|ipod|apple|macintosh/i.test(combined)) return 'Apple'
  if (/samsung|sm-|gt-|galaxy/i.test(combined)) return 'Samsung'
  if (/pixel|google/i.test(combined)) return 'Google'
  if (/xiaomi|redmi|poco|mi\s/i.test(combined)) return 'Xiaomi'
  if (/tecno/i.test(combined)) return 'Tecno'
  if (/infinix/i.test(combined)) return 'Infinix'
  if (/oppo|cph\d/i.test(combined)) return 'Oppo'
  if (/vivo|v\d{4}/i.test(combined)) return 'Vivo'
  if (/realme|rmx\d/i.test(combined)) return 'Realme'
  if (/oneplus|one\s*plus/i.test(combined)) return 'OnePlus'
  if (/huawei|honor/i.test(combined)) return 'Huawei'
  if (/motorola|moto/i.test(combined)) return 'Motorola'
  if (/nokia/i.test(combined)) return 'Nokia'
  if (/sony|xperia/i.test(combined)) return 'Sony'
  if (/asus|rog/i.test(combined)) return 'Asus'

  return 'Generic'
}

/**
 * Main Device, Phone Model & Environment detection function.
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      device_type: 'Desktop',
      device_model: 'Desktop',
      device_brand: 'Unknown',
      phone_model: 'Desktop',
      browser: 'Unknown',
      os: 'Unknown',
      viewport: '0x0',
      screen_resolution: '0x0',
      language: 'en',
      timezone: 'UTC'
    }
  }

  const ua = navigator.userAgent || ''

  // 1. Device Type Detection
  let deviceType: 'Desktop' | 'Tablet' | 'Mobile' = 'Desktop'
  const isTablet =
    /iPad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))/i.test(
      ua
    ) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (isTablet) {
    deviceType = 'Tablet'
  } else if (
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
      ua
    )
  ) {
    deviceType = 'Mobile'
  }

  // 2. Browser Detection
  let browser = 'Unknown'
  if (ua.indexOf('Firefox') > -1) browser = 'Firefox'
  else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) browser = 'Opera'
  else if (ua.indexOf('Trident') > -1) browser = 'Internet Explorer'
  else if (ua.indexOf('Edge') > -1 || ua.indexOf('Edg') > -1) browser = 'Edge'
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome'
  else if (ua.indexOf('Safari') > -1) browser = 'Safari'

  // 3. OS Detection
  let os = 'Unknown'
  if (ua.indexOf('Win') > -1) os = 'Windows'
  else if (
    ua.indexOf('Mac') > -1 &&
    !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
    os = 'macOS'
  else if (ua.indexOf('Linux') > -1 && ua.indexOf('Android') === -1)
    os = 'Linux'
  else if (ua.indexOf('Android') > -1) os = 'Android'
  else if (
    ua.indexOf('like Mac') > -1 ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
    os = 'iOS'

  // 4. Phone / Device Model Detection
  let deviceModel = 'Desktop'
  let deviceBrand = 'Generic'

  if (deviceType === 'Mobile' || deviceType === 'Tablet') {
    if (os === 'iOS') {
      deviceModel = getAppleDeviceModel()
      deviceBrand = 'Apple'
    } else if (cachedHighEntropyModel) {
      deviceModel = cachedHighEntropyModel
      deviceBrand = detectBrand(deviceModel, ua)
    } else {
      const androidModel = extractAndroidModel(ua)
      if (androidModel) {
        deviceModel = androidModel
        deviceBrand = detectBrand(androidModel, ua)
      } else {
        deviceModel =
          deviceType === 'Tablet' ? 'Android Tablet' : 'Android Mobile'
        deviceBrand = detectBrand(deviceModel, ua)
      }
    }
  } else {
    deviceModel = os !== 'Unknown' ? `${os} PC` : 'Desktop'
    deviceBrand =
      os === 'macOS'
        ? 'Apple'
        : os === 'Windows'
          ? 'Microsoft/PC'
          : 'Generic PC'
  }

  const phoneModel =
    deviceType === 'Mobile' || deviceType === 'Tablet'
      ? deviceModel
      : 'None (Desktop)'

  // 5. Dimensions & Environment
  const viewport = `${window.innerWidth}x${window.innerHeight}`
  const screenResolution = `${window.screen?.width || 0}x${window.screen?.height || 0}`
  const language = navigator.language || 'en'
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  return {
    device_type: deviceType,
    device_model: deviceModel,
    device_brand: deviceBrand,
    phone_model: phoneModel,
    browser,
    os,
    viewport,
    screen_resolution: screenResolution,
    language,
    timezone
  }
}
