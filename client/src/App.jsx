import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Could not reach backend — is the server running?'))
  }, [])

  return (
    <div className="app">
      <h1>Hackathon Project</h1>
      <p>{message}</p>
    </div>
  )
}

export default App
