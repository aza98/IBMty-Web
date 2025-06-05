class ChurchApp {
  constructor() {
    this.config = {
      youtube: {
        apiKey: "AIzaSyALhMyuq20yoisXXp8sf7rjvUGyHKC7mGg",
        channelId: "UCfhSTnqLb6vFO28eNm_n0qw",
        apiBase: "https://www.googleapis.com/youtube/v3",
      },
      animations: {
        duration: 800,
        easing: "ease-in-out",
        offset: 100,
      },
      notifications: {
        duration: 5000,
        position: "top-right",
      },
    }

    this.modules = {
      theme: null,
      youtube: null,
      clipboard: null,
      animations: null,
      notifications: null,
    }

    this.liveStreamStatus = {
      isLive: false,
      lastChecked: null,
      checkInterval: null,
    }

    this.init()
  }

  async init() {
    try {
      // Inicializar módulos en orden correcto
      this.modules.notifications = new NotificationManager(this.config.notifications)
      this.modules.theme = new ThemeManager()
      this.modules.clipboard = new ClipboardManager(this.modules.notifications)
      this.modules.animations = new AnimationManager(this.config.animations)
      this.modules.youtube = new YouTubeManager(this.config.youtube, this.modules.notifications)

      await this.initializeDOMFeatures()
      await this.startLiveStreamMonitoring()

      console.log("Church App initialized successfully")
    } catch (error) {
      console.error("Failed to initialize Church App:", error)
      this.modules.notifications?.showNotification("Error al inicializar la aplicación", "error")
    }
  }

  async initializeDOMFeatures() {
    this.updateCurrentYear()
    this.initializeResponsiveFeatures()
    this.setupGlobalEventListeners()

    // Inicializar YouTube después de que el DOM esté listo
    if (this.modules.youtube) {
      await this.modules.youtube.initializeLiveStream()
    }
  }

  async startLiveStreamMonitoring() {
    // Verificar estado cada 2 minutos
    this.liveStreamStatus.checkInterval = setInterval(async () => {
      await this.checkLiveStreamStatus()
    }, 120000)

    // Verificación inicial
    await this.checkLiveStreamStatus()
  }

  async checkLiveStreamStatus() {
    if (!this.modules.youtube) return

    try {
      const latestVideo = await this.modules.youtube.fetchLatestVideo(this.config.youtube.channelId)
      const isCurrentlyLive = latestVideo && this.modules.youtube.isLive(latestVideo)

      // Detectar cambio de estado
      if (isCurrentlyLive && !this.liveStreamStatus.isLive) {
        this.onLiveStreamStarted(latestVideo)
      } else if (!isCurrentlyLive && this.liveStreamStatus.isLive) {
        this.onLiveStreamEnded()
      }

      this.liveStreamStatus.isLive = isCurrentlyLive
      this.liveStreamStatus.lastChecked = new Date()
    } catch (error) {
      console.error("Error checking live stream status:", error)
    }
  }

  onLiveStreamStarted(videoData) {
    console.log("Live stream started:", videoData.snippet.title)

    // Mostrar notificación
    this.modules.notifications?.showNotification("¡Transmisión en vivo iniciada! Únete ahora.", "success", {
      persistent: true,
      action: {
        text: "Ver ahora",
        callback: () => this.scrollToLiveStream(),
      },
    })

    // Actualizar favicon para indicar transmisión en vivo
    this.updateFaviconForLiveStream(true)
  }

  onLiveStreamEnded() {
    console.log("Live stream ended")
    this.updateFaviconForLiveStream(false)
  }

  updateFaviconForLiveStream(isLive) {
    const favicon = document.querySelector('link[rel="icon"]')
    if (favicon) {
      // Cambiar favicon para indicar estado en vivo
      const originalHref = favicon.getAttribute("data-original-href") || favicon.href
      if (!favicon.getAttribute("data-original-href")) {
        favicon.setAttribute("data-original-href", originalHref)
      }

      if (isLive) {
        // Usar un favicon diferente para transmisión en vivo
        favicon.href = originalHref.replace(".ico", "-live.ico")
      } else {
        favicon.href = originalHref
      }
    }
  }

  scrollToLiveStream() {
    const liveStreamElement =
      document.getElementById("youtube-live-embed") || document.querySelector("[data-live-stream]")
    if (liveStreamElement) {
      liveStreamElement.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  updateCurrentYear() {
    const yearElement = document.getElementById("currentYear")
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear()
    }
  }

  initializeResponsiveFeatures() {
    let resizeTimeout
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        this.modules.animations?.refreshScrollTriggers()
        this.handleResponsiveChanges()
      }, 250)
    })
  }

  handleResponsiveChanges() {
    const isMobile = window.innerWidth < 768
    document.documentElement.classList.toggle("mobile-view", isMobile)
  }

  setupGlobalEventListeners() {
    window.addEventListener("error", (event) => {
      console.error("Global error:", event.error)
    })

    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason)
    })

    // Limpiar intervalos al cerrar la página
    window.addEventListener("beforeunload", () => {
      if (this.liveStreamStatus.checkInterval) {
        clearInterval(this.liveStreamStatus.checkInterval)
      }
    })
  }
}

class ThemeManager {
  constructor() {
    this.themes = {
      LIGHT: "light",
      DARK: "dark",
    }
    this.storageKey = "preferred-theme"
    this.currentTheme = this.getInitialTheme()
    this.init()
  }

  init() {
    this.applyTheme(this.currentTheme)
    this.setupEventListeners()
    this.updateThemeIcon()
    this.watchSystemTheme()
  }

  getInitialTheme() {
    const savedTheme = localStorage.getItem(this.storageKey)
    if (savedTheme && Object.values(this.themes).includes(savedTheme)) {
      return savedTheme
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? this.themes.DARK : this.themes.LIGHT
  }

  applyTheme(theme) {
    const root = document.documentElement
    root.setAttribute("data-theme", theme)
    root.setAttribute("data-bs-theme", theme)

    // Aplicar clase CSS para transiciones suaves
    root.classList.add("theme-transition")
    setTimeout(() => root.classList.remove("theme-transition"), 300)

    this.updateMetaThemeColor(theme)
    this.currentTheme = theme
    this.dispatchThemeChangeEvent(theme)
  }

  updateMetaThemeColor(theme) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta")
      metaThemeColor.name = "theme-color"
      document.head.appendChild(metaThemeColor)
    }

    const colors = {
      [this.themes.LIGHT]: "#ffffff",
      [this.themes.DARK]: "#121212",
    }
    metaThemeColor.content = colors[theme]
  }

  setTheme(theme, saveToStorage = true) {
    if (!Object.values(this.themes).includes(theme)) {
      console.warn(`Invalid theme: ${theme}`)
      return
    }

    this.applyTheme(theme)
    if (saveToStorage) {
      localStorage.setItem(this.storageKey, theme)
    }
    this.updateThemeIcon()
  }

  toggleTheme() {
    const newTheme = this.currentTheme === this.themes.LIGHT ? this.themes.DARK : this.themes.LIGHT
    this.setTheme(newTheme)
  }

  updateThemeIcon() {
    const themeButtons = document.querySelectorAll(".theme-toggle, [data-theme-toggle], #themeToggle")

    themeButtons.forEach((button) => {
      // Buscar iconos con diferentes selectores posibles
      const lightIcon = button.querySelector('.theme-icon-light, .fa-moon, .icon-moon, [data-icon="moon"]')
      const darkIcon = button.querySelector('.theme-icon-dark, .fa-sun, .icon-sun, [data-icon="sun"]')

      if (lightIcon && darkIcon) {
        if (this.currentTheme === this.themes.DARK) {
          // Modo oscuro activo - mostrar icono de sol
          lightIcon.style.display = "none"
          darkIcon.style.display = "inline-block"
          button.setAttribute("aria-label", "Cambiar a modo claro")
          button.setAttribute("title", "Cambiar a modo claro")
        } else {
          // Modo claro activo - mostrar icono de luna
          lightIcon.style.display = "inline-block"
          darkIcon.style.display = "none"
          button.setAttribute("aria-label", "Cambiar a modo oscuro")
          button.setAttribute("title", "Cambiar a modo oscuro")
        }
      } else {
        // Fallback: cambiar clases de FontAwesome
        const icon = button.querySelector("i")
        if (icon) {
          if (this.currentTheme === this.themes.DARK) {
            icon.className = icon.className.replace("fa-moon", "fa-sun")
            button.setAttribute("aria-label", "Cambiar a modo claro")
          } else {
            icon.className = icon.className.replace("fa-sun", "fa-moon")
            button.setAttribute("aria-label", "Cambiar a modo oscuro")
          }
        }
      }
    })
  }

  setupEventListeners() {
    document.addEventListener("click", (e) => {
      const themeButton = e.target.closest(".theme-toggle, [data-theme-toggle], #themeToggle")
      if (themeButton) {
        e.preventDefault()
        this.toggleTheme()

        // Animación de feedback
        themeButton.style.transform = "scale(0.95)"
        setTimeout(() => {
          themeButton.style.transform = "scale(1)"
        }, 150)
      }
    })

    document.addEventListener("keydown", (e) => {
      const themeButton = e.target.closest(".theme-toggle, [data-theme-toggle], #themeToggle")
      if (themeButton && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault()
        this.toggleTheme()
      }
    })
  }

  watchSystemTheme() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      mediaQuery.addEventListener("change", (e) => {
        if (!localStorage.getItem(this.storageKey)) {
          const systemTheme = e.matches ? this.themes.DARK : this.themes.LIGHT
          this.setTheme(systemTheme, false)
        }
      })
    }
  }

  dispatchThemeChangeEvent(theme) {
    const event = new CustomEvent("themechange", {
      detail: {
        theme,
        previousTheme: this.currentTheme === theme ? null : this.currentTheme,
      },
    })
    document.dispatchEvent(event)
  }

  getCurrentTheme() {
    return this.currentTheme
  }

  isDarkMode() {
    return this.currentTheme === this.themes.DARK
  }
}

class YouTubeManager {
  constructor(config, notificationManager) {
    this.config = config
    this.notifications = notificationManager
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutos
    this.rateLimitDelay = 1000 // 1 segundo entre requests
    this.lastRequestTime = 0
  }

  async fetchWithRateLimit(url) {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest))
    }

    this.lastRequestTime = Date.now()
    return fetch(url)
  }

  async fetchLatestVideo(channelId) {
    if (!this.isValidApiKey()) {
      console.warn("YouTube API Key not configured properly")
      return null
    }

    const cacheKey = `latest_video_${channelId}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    try {
      const url = `${this.config.apiBase}/search?key=${this.config.apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=1&type=video`
      const response = await this.fetchWithRateLimit(url)

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("API quota exceeded or invalid API key")
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const result = data.items?.[0] || null

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      })

      return result
    } catch (error) {
      console.error("Error fetching latest video:", error)
      this.notifications?.showNotification("Error al obtener información del video de YouTube", "error")
      return null
    }
  }

  async getViewerCount(videoId) {
    if (!this.isValidApiKey()) {
      return "0"
    }

    const cacheKey = `viewer_count_${videoId}`
    const cached = this.cache.get(cacheKey)

    // Cache viewer count for shorter time (30 seconds)
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.data
    }

    try {
      const url = `${this.config.apiBase}/videos?key=${this.config.apiKey}&id=${videoId}&part=liveStreamingDetails,statistics`
      const response = await this.fetchWithRateLimit(url)

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const data = await response.json()
      const video = data.items?.[0]

      // Priorizar viewer count en vivo, luego view count total
      const viewerCount = video?.liveStreamingDetails?.concurrentViewers || video?.statistics?.viewCount || "0"

      this.cache.set(cacheKey, {
        data: viewerCount,
        timestamp: Date.now(),
      })

      return viewerCount
    } catch (error) {
      console.error("Error fetching viewer count:", error)
      return "0"
    }
  }

  isLive(videoData) {
    return videoData?.snippet?.liveBroadcastContent === "live"
  }

  getShareLink(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`
  }

  getSubscribeLink(channelId) {
    return `https://www.youtube.com/channel/${channelId}?sub_confirmation=1`
  }

  isValidApiKey() {
    return this.config.apiKey && this.config.apiKey !== "YOUR_YOUTUBE_API_KEY" && this.config.apiKey.length > 20 // API keys are typically longer
  }

  async initializeLiveStream() {
    const elements = {
      liveStatusDot: document.getElementById("liveStatusDot"),
      liveStatusBadge: document.getElementById("liveStatusBadge"),
      viewerCount: document.getElementById("viewerCount"),
      youtubeEmbed: document.getElementById("youtube-live-embed"),
      shareButton: document.getElementById("shareButton"),
      subscribeButton: document.getElementById("subscribeButton"),
    }

    const requiredElements = Object.values(elements).filter(Boolean)
    if (requiredElements.length === 0) {
      console.warn("No live stream elements found in DOM")
      return
    }

    try {
      const latestVideo = await this.fetchLatestVideo(this.config.channelId)

      if (latestVideo && this.isLive(latestVideo)) {
        await this.setupLiveStream(elements, latestVideo)
      } else if (latestVideo) {
        this.setupLatestVideo(elements, latestVideo)
      } else {
        this.setupFallbackState(elements)
      }

      this.setupEventListeners(elements)
    } catch (error) {
      console.error("Failed to initialize live stream:", error)
      this.setupErrorState(elements)
    }
  }

  setupEventListeners(elements) {
    if (elements.shareButton) {
      elements.shareButton.addEventListener("click", () => this.shareVideo(elements.youtubeEmbed))
    }

    if (elements.subscribeButton) {
      elements.subscribeButton.addEventListener("click", () => {
        window.open(this.getSubscribeLink(this.config.channelId), "_blank")
      })
    }
  }

  async setupLiveStream(elements, videoData) {
    const videoId = videoData.id.videoId
    const viewerCount = await this.getViewerCount(videoId)

    if (elements.liveStatusDot) {
      elements.liveStatusDot.style.backgroundColor = "#dc3545"
      elements.liveStatusDot.classList.add("pulse-animation")
    }

    if (elements.liveStatusBadge) {
      elements.liveStatusBadge.textContent = "EN VIVO"
      elements.liveStatusBadge.className = "badge bg-danger"
    }

    if (elements.viewerCount) {
      elements.viewerCount.textContent = this.formatViewerCount(viewerCount)
    }

    if (elements.youtubeEmbed) {
      elements.youtubeEmbed.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0`
    }

    console.log(`Live stream active: ${videoData.snippet.title}, Viewers: ${viewerCount}`)
  }

  setupLatestVideo(elements, videoData) {
    const videoId = videoData.id.videoId

    if (elements.liveStatusDot) {
      elements.liveStatusDot.style.backgroundColor = "#6c757d"
      elements.liveStatusDot.classList.remove("pulse-animation")
    }

    if (elements.liveStatusBadge) {
      elements.liveStatusBadge.textContent = "ÚLTIMO VIDEO"
      elements.liveStatusBadge.className = "badge bg-secondary"
    }

    if (elements.viewerCount) {
      elements.viewerCount.textContent = "N/A"
    }

    if (elements.youtubeEmbed) {
      elements.youtubeEmbed.src = `https://www.youtube.com/embed/${videoId}?rel=0`
    }

    console.log(`Showing latest video: ${videoData.snippet.title}`)
  }

  setupFallbackState(elements) {
    if (elements.liveStatusDot) {
      elements.liveStatusDot.style.backgroundColor = "#6c757d"
      elements.liveStatusDot.classList.remove("pulse-animation")
    }

    if (elements.liveStatusBadge) {
      elements.liveStatusBadge.textContent = "NO DISPONIBLE"
      elements.liveStatusBadge.className = "badge bg-secondary"
    }

    if (elements.viewerCount) {
      elements.viewerCount.textContent = "N/A"
    }
  }

  setupErrorState(elements) {
    if (elements.liveStatusBadge) {
      elements.liveStatusBadge.textContent = "ERROR"
      elements.liveStatusBadge.className = "badge bg-warning"
    }

    if (elements.liveStatusDot) {
      elements.liveStatusDot.style.backgroundColor = "#ffc107"
    }
  }

  formatViewerCount(count) {
    const num = Number.parseInt(count)
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M"
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K"
    }
    return num.toString()
  }

  async shareVideo(embedElement) {
    if (!embedElement?.src) {
      this.notifications?.showNotification("No se puede compartir: video no encontrado.", "error")
      return
    }

    const videoId = this.extractVideoId(embedElement.src)
    if (!videoId) {
      this.notifications?.showNotification("Error al obtener ID del video para compartir.", "error")
      return
    }

    const shareLink = this.getShareLink(videoId)
    const shareData = {
      title: "Transmisión en Vivo - Iglesia Bautista de Monterrey",
      text: "Únete a nuestro servicio en vivo o mira el último video.",
      url: shareLink,
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        if (error.name !== "AbortError") {
          console.log("Error sharing:", error)
          this.fallbackShare(shareLink)
        }
      }
    } else {
      this.fallbackShare(shareLink)
    }
  }

  async fallbackShare(shareLink) {
    try {
      await navigator.clipboard.writeText(shareLink)
      this.notifications?.showNotification("¡Enlace copiado al portapapeles!", "success")
    } catch (error) {
      console.error("Error copying link:", error)
      this.notifications?.showNotification("Error al copiar enlace.", "error")
    }
  }

  extractVideoId(url) {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split("/")
      const videoId = pathParts[pathParts.length - 1]

      // Limpiar parámetros adicionales
      return videoId.split("?")[0]
    } catch (error) {
      console.error("Invalid embed URL:", url, error)
      return null
    }
  }
}

class ClipboardManager {
  constructor(notificationManager) {
    this.notifications = notificationManager
    this.init()
  }

  init() {
    this.setupCopyButtons()
  }

  setupCopyButtons() {
    document.addEventListener("click", async (e) => {
      const copyButton = e.target.closest(".copy-btn, [data-copy]")
      if (!copyButton) return

      e.preventDefault()

      const textToCopy = copyButton.getAttribute("data-copy") || copyButton.textContent.trim()

      if (!textToCopy) {
        console.warn("No text to copy found")
        this.notifications?.showNotification("No hay texto para copiar", "warning")
        return
      }

      await this.copyToClipboard(textToCopy, copyButton)
    })
  }

  async copyToClipboard(text, button) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        this.fallbackCopy(text)
      }

      this.showCopySuccess(button)
      this.notifications?.showNotification("¡Texto copiado al portapapeles!", "success")
    } catch (error) {
      console.error("Failed to copy text:", error)

      try {
        this.fallbackCopy(text)
        this.showCopySuccess(button)
        this.notifications?.showNotification("¡Texto copiado al portapapeles!", "success")
      } catch (fallbackError) {
        console.error("Fallback copy also failed:", fallbackError)
        this.notifications?.showNotification("Error al copiar texto", "error")
      }
    }
  }

  fallbackCopy(text) {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.left = "-999999px"
    textArea.style.top = "-999999px"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    const successful = document.execCommand("copy")
    document.body.removeChild(textArea)

    if (!successful) {
      throw new Error("Fallback copy command failed")
    }
  }

  showCopySuccess(button) {
    button.classList.add("copy-success")

    const icon = button.querySelector("i, .icon")
    if (icon) {
      const originalClasses = icon.className
      const originalContent = icon.textContent

      // Cambiar icono a check
      if (icon.classList.contains("fa-copy")) {
        icon.className = icon.className.replace("fa-copy", "fa-check")
      } else if (icon.classList.contains("fa-clipboard")) {
        icon.className = icon.className.replace("fa-clipboard", "fa-check")
      } else {
        icon.textContent = "✓"
      }

      setTimeout(() => {
        button.classList.remove("copy-success")
        icon.className = originalClasses
        if (originalContent) {
          icon.textContent = originalContent
        }
      }, 2000)
    }
  }
}

class AnimationManager {
  constructor(config) {
    this.config = config
    this.init()
  }

  init() {
    this.initializeAOS()
    this.setupFormValidation()
    this.setupScrollAnimations()
  }

  initializeAOS() {
    if (typeof AOS !== "undefined") {
      try {
        AOS.init({
          duration: this.config.duration,
          easing: this.config.easing,
          once: true,
          offset: this.config.offset,
          mirror: false,
          anchorPlacement: "top-bottom",
          disable: () => {
            // Deshabilitar en dispositivos con movimiento reducido
            return window.matchMedia("(prefers-reduced-motion: reduce)").matches
          },
        })

        console.log("AOS initialized successfully")
      } catch (error) {
        console.error("Error initializing AOS:", error)
      }
    } else {
      console.warn("AOS library not loaded")
      this.loadAOSFallback()
    }
  }

  loadAOSFallback() {
    // Fallback simple para animaciones si AOS no está disponible
    const elements = document.querySelectorAll("[data-aos]")
    elements.forEach((element) => {
      element.style.opacity = "0"
      element.style.transform = "translateY(20px)"
      element.style.transition = "opacity 0.6s ease, transform 0.6s ease"

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.style.opacity = "1"
              entry.target.style.transform = "translateY(0)"
              observer.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.1 },
      )

      observer.observe(element)
    })
  }

  setupFormValidation() {
    const forms = document.querySelectorAll(".needs-validation")
    forms.forEach((form) => {
      form.addEventListener("submit", (event) => {
        if (!form.checkValidity()) {
          event.preventDefault()
          event.stopPropagation()

          // Enfocar el primer campo inválido
          const firstInvalid = form.querySelector(":invalid")
          if (firstInvalid) {
            firstInvalid.focus()
          }
        }
        form.classList.add("was-validated")
      })

      // Validación en tiempo real
      const inputs = form.querySelectorAll("input, textarea, select")
      inputs.forEach((input) => {
        input.addEventListener("blur", () => {
          if (form.classList.contains("was-validated")) {
            input.checkValidity()
          }
        })
      })
    })
  }

  setupScrollAnimations() {
    // Animación de scroll suave para enlaces internos
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]')
      if (link) {
        const targetId = link.getAttribute("href").substring(1)
        const targetElement = document.getElementById(targetId)

        if (targetElement) {
          e.preventDefault()
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
      }
    })
  }

  refreshScrollTriggers() {
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.refresh()
    }

    if (typeof AOS !== "undefined") {
      AOS.refresh()
    }
  }
}

class NotificationManager {
  constructor(config) {
    this.config = config
    this.notifications = []
    this.container = null
    this.init()
  }

  init() {
    this.createContainer()
    this.setupStyles()
  }

  createContainer() {
    this.container = document.createElement("div")
    this.container.id = "notification-container"
    this.container.className = `notification-container ${this.config.position}`
    document.body.appendChild(this.container)
  }

  setupStyles() {
    if (!document.getElementById("notification-styles")) {
      const styles = document.createElement("style")
      styles.id = "notification-styles"
      styles.textContent = `
                .notification-container {
                    position: fixed;
                    z-index: 9999;
                    pointer-events: none;
                }
                
                .notification-container.top-right {
                    top: 20px;
                    right: 20px;
                }
                
                .notification-container.top-left {
                    top: 20px;
                    left: 20px;
                }
                
                .notification-container.bottom-right {
                    bottom: 20px;
                    right: 20px;
                }
                
                .notification-container.bottom-left {
                    bottom: 20px;
                    left: 20px;
                }
                
                .notification {
                    background: white;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    border-left: 4px solid #007bff;
                    max-width: 400px;
                    pointer-events: auto;
                    transform: translateX(100%);
                    opacity: 0;
                    transition: all 0.3s ease;
                    position: relative;
                }
                
                .notification.show {
                    transform: translateX(0);
                    opacity: 1;
                }
                
                .notification.success {
                    border-left-color: #28a745;
                }
                
                .notification.error {
                    border-left-color: #dc3545;
                }
                
                .notification.warning {
                    border-left-color: #ffc107;
                }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .notification-icon {
                    font-size: 20px;
                    flex-shrink: 0;
                }
                
                .notification-text {
                    flex: 1;
                    font-size: 14px;
                    line-height: 1.4;
                }
                
                .notification-close {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    opacity: 0.5;
                    transition: opacity 0.2s;
                }
                
                .notification-close:hover {
                    opacity: 1;
                }
                
                .notification-action {
                    margin-top: 8px;
                }
                
                .notification-action button {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                .notification-action button:hover {
                    background: #0056b3;
                }
                
                [data-theme="dark"] .notification {
                    background: #2d3748;
                    color: white;
                }
            `
      document.head.appendChild(styles)
    }
  }

  showNotification(message, type = "info", options = {}) {
    const notification = this.createNotification(message, type, options)
    this.container.appendChild(notification)
    this.notifications.push(notification)

    // Mostrar animación
    setTimeout(() => notification.classList.add("show"), 10)

    // Auto-remove si no es persistente
    if (!options.persistent) {
      setTimeout(() => {
        this.removeNotification(notification)
      }, options.duration || this.config.duration)
    }

    return notification
  }

  createNotification(message, type, options) {
    const notification = document.createElement("div")
    notification.className = `notification ${type}`

    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    }

    notification.innerHTML = `
            <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
            <div class="notification-content">
                <div class="notification-icon">${icons[type] || icons.info}</div>
                <div class="notification-text">${message}</div>
            </div>
            ${
              options.action
                ? `
                <div class="notification-action">
                    <button onclick="(${options.action.callback.toString()})(); this.closest('.notification').remove();">
                        ${options.action.text}
                    </button>
                </div>
            `
                : ""
            }
        `

    return notification
  }

  removeNotification(notification) {
    notification.classList.remove("show")
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification)
      }
      const index = this.notifications.indexOf(notification)
      if (index > -1) {
        this.notifications.splice(index, 1)
      }
    }, 300)
  }

  clearAll() {
    this.notifications.forEach((notification) => {
      this.removeNotification(notification)
    })
  }
}

// Inicialización cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  window.app = new ChurchApp()
})

// Exportar para uso en módulos
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ChurchApp,
    ThemeManager,
    YouTubeManager,
    ClipboardManager,
    AnimationManager,
    NotificationManager,
  }
}
