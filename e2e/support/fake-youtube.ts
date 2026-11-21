import type { BrowserContext } from '@playwright/test'

/**
 * Une fausse API IFrame YouTube, servie à la place de la vraie (`youtube.com/iframe_api`).
 *
 * Les tests ne dépendent ainsi d'aucun réseau externe, et le moteur de la platine tourne pour de
 * vrai : deux decks, lecture, pause, fin de morceau, fondu enchaîné, volume. Le « lecteur » fait
 * avancer une horloge (accélérable avec `window.__ytSpeed`) et s'affiche comme un simple cadre.
 * Durées par vidéo : `window.__ytDurations = { id: secondes }` (200 s par défaut). Les lecteurs
 * créés sont dans `window.__ytPlayers` (un test peut y avancer l'horloge : `player.t`).
 */
export const FAKE_YT_API = `(() => {
  const S = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }
  function Player(el, opts) {
    const node = typeof el === 'string' ? document.getElementById(el) : el
    const frame = document.createElement('div')
    frame.setAttribute('data-fake-yt', '')
    frame.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font:13px sans-serif;color:#9a96a6;background:linear-gradient(135deg,#1c1a24,#0c0b10)'
    node.replaceWith(frame)
    this.frame = frame
    this.events = (opts && opts.events) || {}
    this.state = S.UNSTARTED
    this.t = 0
    this.dur = 0
    this.vol = 100
    this.id = null
    this.last = performance.now()
    const self = this
    ;(window.__ytPlayers = window.__ytPlayers || []).push(this)
    setTimeout(() => self.events.onReady && self.events.onReady({ target: self }), 30)
    this.timer = setInterval(() => self.tick(), 100)
  }
  Player.prototype.durationOf = function (id) { return (window.__ytDurations && window.__ytDurations[id]) || 200 }
  Player.prototype.set = function (s) { this.state = s; this.events.onStateChange && this.events.onStateChange({ data: s, target: this }) }
  Player.prototype.tick = function () {
    const now = performance.now()
    if (this.state === S.PLAYING) {
      this.t += ((now - this.last) / 1000) * (window.__ytSpeed || 1)
      if (this.t >= this.dur) { this.t = this.dur; this.set(S.ENDED) }
    }
    this.last = now
    this.frame.dataset.video = this.id || ''
    this.frame.dataset.volume = String(this.vol)
    this.frame.dataset.state = String(this.state)
    this.frame.textContent = this.id ? ('▶ ' + this.id + ' · ' + this.t.toFixed(1) + ' s · vol ' + this.vol) : ''
  }
  Player.prototype.loadVideoById = function (id, start) {
    this.id = id; this.t = start || 0; this.dur = this.durationOf(id); this.last = performance.now()
    this.set(S.BUFFERING)
    const self = this
    setTimeout(() => { if (self.id === id && self.state === S.BUFFERING) self.set(S.PLAYING) }, 120)
  }
  Player.prototype.cueVideoById = function (id, start) { this.id = id; this.t = start || 0; this.dur = this.durationOf(id); this.set(S.CUED) }
  Player.prototype.playVideo = function () { if (this.id && this.state !== S.PLAYING && this.state !== S.BUFFERING) { this.last = performance.now(); this.set(S.PLAYING) } }
  Player.prototype.pauseVideo = function () { if (this.state === S.PLAYING || this.state === S.BUFFERING) this.set(S.PAUSED) }
  Player.prototype.getCurrentTime = function () { return this.t }
  Player.prototype.getDuration = function () { return this.dur }
  Player.prototype.getPlayerState = function () { return this.state }
  Player.prototype.setVolume = function (v) { this.vol = v }
  Player.prototype.destroy = function () { clearInterval(this.timer) }
  window.YT = { Player, PlayerState: S }
  setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 0)
})()`

/** Remplace l'API YouTube du contexte par la fausse, et coupe tout autre appel vers YouTube. */
export async function installFakeYouTube(ctx: BrowserContext): Promise<void> {
  await ctx.route(/youtube\.com|ytimg\.com|googleapis\.com/, (route) => route.abort())
  await ctx.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_YT_API }),
  )
}
