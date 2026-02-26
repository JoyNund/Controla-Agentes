import { useState } from 'react'

export default function KeywordModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description = 'Ingrese la palabra clave para confirmar esta acción:', 
  allowEmpty = false,
  customField = null // { label, value, onChange, placeholder, type }
}) {
  const [keyword, setKeyword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    // Si allowEmpty es true, permitir keyword vacía
    if (!keyword.trim() && !allowEmpty) {
      setError('La palabra clave es requerida')
      return
    }

    setError('')
    setLoading(true)

    try {
      await onConfirm(keyword)
      setKeyword('')
      onClose()
    } catch (err) {
      setError(err.message || 'Palabra clave incorrecta')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      submit()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {description}
        </p>

        {/* Campo personalizado (si existe) */}
        {customField && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {customField.label}
            </label>
            <input
              type={customField.type || 'text'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={customField.value}
              onChange={(e) => customField.onChange(e.target.value)}
              placeholder={customField.placeholder}
              autoFocus
              disabled={loading}
            />
          </div>
        )}

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Palabra Clave de Seguridad
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Palabra clave"
            autoFocus={!customField}
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          {allowEmpty && (
            <button
              type="button"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              onClick={() => submit()}
              disabled={loading}
            >
              Omitir
            </button>
          )}
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
