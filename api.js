const BACKEND_URL = "http://host.docker.internal:8000" 

export function loginAgent(username, password) {
  return fetch(`${BACKEND_URL}/api/agent/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })
  .then(response => {
    if (!response.ok) {
      return null;
    }
    return response.json();
  })
  .catch(error => {
    console.error('Login error:', error);
    return null;
  });
}