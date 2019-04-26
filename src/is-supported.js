// http://stackoverflow.com/a/27081419
export default function isSupported (storageType) {
  if (typeof storageType === 'object') {
    try {
      storageType.setItem('localStorage', 1)
      storageType.removeItem('localStorage')
      return true
    } catch (e) {
      return false
    }
  }

  return false
}
