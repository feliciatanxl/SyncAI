import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { FluentProvider } from '@fluentui/react-components'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Workspace from './pages/Workspace.jsx'
import StatusPage from './pages/StatusPage.jsx'
import StatusCodes from './pages/StatusCodes.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import { usePreferences } from './lib/i18n.js'
import { PreferencesProvider } from './lib/preferences.jsx'

function ThemedApp() {
  return (
    <FluentProvider theme={usePreferences().theme} className="app-root">
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

export default function App() {
  return <PreferencesProvider><ThemedApp /></PreferencesProvider>
}
