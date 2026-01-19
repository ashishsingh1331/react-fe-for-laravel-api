import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000/api'
const AUTH_URL = `${API_BASE}/auth`
const POSTS_URL = `${API_BASE}/posts`

function App() {
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  })
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem('auth_token') || ''
  )
  const [authUser, setAuthUser] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const isEditing = editingId !== null
  const isAuthed = Boolean(authToken)

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [posts])

  const latestUpdated = useMemo(() => {
    if (posts.length === 0) return null
    return posts.reduce((latest, post) => {
      if (!latest) return post
      return new Date(post.updated_at) > new Date(latest.updated_at) ? post : latest
    }, null)
  }, [posts])

  const resetForm = () => {
    setForm({ title: '', description: '' })
    setEditingId(null)
  }

  const fetchPosts = async () => {
    if (!authToken) {
      setIsLoading(false)
      setError('Sign in to load posts.')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(POSTS_URL, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please sign in again.')
        }
        throw new Error('Failed to fetch posts.')
      }
      const data = await response.json()
      setPosts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      if (err instanceof Error && err.message.includes('Session expired')) {
        clearAuth()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const clearAuth = () => {
    localStorage.removeItem('auth_token')
    setAuthToken('')
    setAuthUser(null)
  }

  const fetchMe = async (token) => {
    if (!token) return
    try {
      const response = await fetch(`${AUTH_URL}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        clearAuth()
        return
      }
      const data = await response.json()
      setAuthUser(data)
    } catch {
      clearAuth()
    }
  }

  useEffect(() => {
    if (authToken) {
      fetchMe(authToken)
      fetchPosts()
    } else {
      setPosts([])
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleAuthChange = (event) => {
    const { name, value } = event.target
    setAuthForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleAuthMode = (mode) => {
    setAuthMode(mode)
    setAuthError('')
  }

  const extractToken = (payload) => {
    if (!payload || typeof payload !== 'object') return ''
    return payload.access_token || payload.token || payload?.data?.access_token || ''
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      const endpoint =
        authMode === 'register' ? `${AUTH_URL}/register` : `${AUTH_URL}/login`
      const body =
        authMode === 'register'
          ? {
              name: authForm.name.trim(),
              email: authForm.email.trim(),
              password: authForm.password,
              password_confirmation: authForm.passwordConfirmation,
            }
          : {
              email: authForm.email.trim(),
              password: authForm.password,
            }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message =
          data?.message ||
          (typeof data?.error === 'string' ? data.error : null) ||
          (data?.errors
            ? Object.values(data.errors).flat().join(' ')
            : null) ||
          'Authentication failed.'
        throw new Error(message)
      }
      const token = extractToken(data)
      if (!token) {
        throw new Error('No token returned from the API.')
      }
      localStorage.setItem('auth_token', token)
      setAuthToken(token)
      setAuthForm({
        name: '',
        email: '',
        password: '',
        passwordConfirmation: '',
      })
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!authToken) return
    setAuthLoading(true)
    setAuthError('')
    try {
      await fetch(`${AUTH_URL}/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
    } finally {
      clearAuth()
      setAuthLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required.')
      return
    }
    if (!authToken) {
      setError('Sign in to create or edit posts.')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const response = await fetch(
        isEditing ? `${POSTS_URL}/${editingId}` : POSTS_URL,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description.trim(),
          }),
        }
      )
      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} post.`)
      }
      resetForm()
      await fetchPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (post) => {
    setEditingId(post.id)
    setForm({ title: post.title ?? '', description: post.description ?? '' })
  }

  const handleCancelEdit = () => {
    resetForm()
  }

  const handleDelete = async (postId) => {
    const confirmed = window.confirm('Delete this post? This cannot be undone.')
    if (!confirmed) return

    setDeletingId(postId)
    setError('')
    try {
      const response = await fetch(`${POSTS_URL}/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      if (!response.ok) {
        throw new Error('Failed to delete post.')
      }
      setPosts((prev) => prev.filter((post) => post.id !== postId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Posts studio</p>
          <h1>Craft, refine, and publish your next update.</h1>
          <p className="subhead">
            A simple CRUD dashboard connected to your local API.
          </p>
        </div>
        <div className="hero-card">
          {isAuthed ? (
            <>
              <div>
                <p className="stat-label">Signed in as</p>
                <p className="stat-value">
                  {authUser?.email || authUser?.name || 'Account'}
                </p>
              </div>
              <button className="ghost" type="button" onClick={handleLogout}>
                {authLoading ? 'Signing out...' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="stat-label">Total posts</p>
                <p className="stat-value">{posts.length}</p>
              </div>
              <div>
                <p className="stat-label">Last updated</p>
                <p className="stat-value">
                  {latestUpdated?.updated_at
                    ? formatDate(latestUpdated.updated_at)
                    : '-'}
                </p>
              </div>
            </>
          )}
        </div>
      </header>

      {!isAuthed && (
        <form className="panel" onSubmit={handleAuthSubmit}>
          <div className="panel-header">
            <div>
              <h2>{authMode === 'register' ? 'Create account' : 'Sign in'}</h2>
              <p className="muted">
                {authMode === 'register'
                  ? 'Register to start creating posts.'
                  : 'Use your account to manage posts.'}
              </p>
            </div>
            <div className="post-actions">
              <button
                type="button"
                className={authMode === 'login' ? 'primary' : 'ghost'}
                onClick={() => handleAuthMode('login')}
                disabled={authLoading}
              >
                Sign in
              </button>
              <button
                type="button"
                className={authMode === 'register' ? 'primary' : 'ghost'}
                onClick={() => handleAuthMode('register')}
                disabled={authLoading}
              >
                Register
              </button>
            </div>
          </div>
          {authError && <div className="alert">{authError}</div>}
          {authMode === 'register' && (
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                value={authForm.name}
                onChange={handleAuthChange}
                placeholder="Jane Doe"
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              value={authForm.email}
              onChange={handleAuthChange}
              placeholder="you@example.com"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              value={authForm.password}
              onChange={handleAuthChange}
              placeholder="Enter a secure password"
            />
          </label>
          {authMode === 'register' && (
            <label className="field">
              <span>Confirm password</span>
              <input
                name="passwordConfirmation"
                type="password"
                value={authForm.passwordConfirmation}
                onChange={handleAuthChange}
                placeholder="Re-enter your password"
              />
            </label>
          )}
          <button className="primary" type="submit" disabled={authLoading}>
            {authLoading
              ? 'Submitting...'
              : authMode === 'register'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
      )}

      {error && <div className="alert">{error}</div>}

      {isAuthed && (
        <section className="content-grid">
          <form className="panel" onSubmit={handleSubmit}>
            <div className="panel-header">
              <div>
                <h2>{isEditing ? 'Edit post' : 'Create post'}</h2>
                <p className="muted">
                  {isEditing
                    ? 'Update the title or description, then save changes.'
                    : 'Add a title and description to publish a new post.'}
                </p>
              </div>
              {isEditing && (
                <button
                  type="button"
                  className="ghost"
                  onClick={handleCancelEdit}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <label className="field">
              <span>Title</span>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Give it a short, punchy headline"
              />
            </label>

            <label className="field">
              <span>Description</span>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Write something that feels alive."
                rows={5}
              />
            </label>

            <button className="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEditing ? 'Update post' : 'Publish post'}
            </button>
          </form>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>All posts</h2>
                <p className="muted">Review, update, or remove existing posts.</p>
              </div>
              <button className="ghost" type="button" onClick={fetchPosts}>
                Refresh
              </button>
            </div>

            {isLoading ? (
              <p className="muted">Loading posts...</p>
            ) : sortedPosts.length === 0 ? (
              <p className="muted">No posts yet. Start with a new one.</p>
            ) : (
              <div className="post-list">
                {sortedPosts.map((post) => (
                  <article className="post-card" key={post.id}>
                    <div>
                      <h3>{post.title}</h3>
                      <p>{post.description}</p>
                    </div>
                    <div className="post-meta">
                      <span>Created {formatDate(post.created_at)}</span>
                      <span>Updated {formatDate(post.updated_at)}</span>
                    </div>
                    <div className="post-actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleEdit(post)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(post.id)}
                        disabled={deletingId === post.id}
                      >
                        {deletingId === post.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}
    </div>
  )
}

export default App
