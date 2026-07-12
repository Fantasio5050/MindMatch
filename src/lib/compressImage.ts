/** Resizes + re-encodes a picked photo client-side (canvas) before upload — keeps the payload
 * small (a few dozen KB) regardless of how large the original camera/gallery photo is. */
export function compressImage(file: File, maxSize = 320, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onerror = () => reject(new Error("Impossible de lire l'image."))
    reader.onload = () => {
      img.onerror = () => reject(new Error('Fichier image invalide.'))
      img.onload = () => {
        // Crop a centered square out of the original image, then scale that down — cropping
        // first (in the image's own pixel space) keeps the math simple and avoids distortion.
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        const outputSize = Math.min(maxSize, side)

        const canvas = document.createElement('canvas')
        canvas.width = outputSize
        canvas.height = outputSize
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas non disponible.'))
        ctx.drawImage(img, sx, sy, side, side, 0, 0, outputSize, outputSize)

        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
