import { useEffect, useState } from 'react'

function App() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Could not reach backend — is the server running?'))
  }, [])

  return (
    <div className="mx-auto my-16 max-w-xl px-6 text-center">
      <h1>Hackathon Project</h1>
      <p>{message}</p>
    </div>
  )
}

export default App
