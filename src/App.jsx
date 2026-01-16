import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = 'http://127.0.0.1:8000/api/posts'

function App() {
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const isEditing = editingId !== null

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
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(API_URL)
      if (!response.ok) {
        throw new Error('Failed to fetch posts.')
      }
      const data = await response.json()
      setPosts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required.')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const response = await fetch(
        isEditing ? `${API_URL}/${editingId}` : API_URL,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
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
      const response = await fetch(`${API_URL}/${postId}`, { method: 'DELETE' })
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
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

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
              <button type="button" className="ghost" onClick={handleCancelEdit}>
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
    </div>
  )
}

export default App
