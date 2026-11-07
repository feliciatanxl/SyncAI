import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Workspace from './pages/Workspace.jsx'
import StatusPage from './pages/StatusPage.jsx'
import StatusCodes from './pages/StatusCodes.jsx'
import RequireAuth from './components/RequireAuth.jsx'

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function useSystemTheme() {
  const [dark, setDark] = useState(darkQuery.matches)
  useEffect(() => {
    const onChange = (e) => setDark(e.matches)
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [])
  return dark ? webDarkTheme : webLightTheme
}

export default function App() {
  return (
    <FluentProvider theme={useSystemTheme()} className="app-root">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<RequireAuth><Workspace /></RequireAuth>} />
          <Route path="/status" element={<StatusCodes />} />
          <Route path="/status/:code" element={<StatusPage />} />
          <Route path="*" element={<StatusPage code={404} />} />
        </Routes>
      </BrowserRouter>
    </FluentProvider>
  )
}
