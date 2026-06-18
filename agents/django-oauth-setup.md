# Django OAuth Toolkit — Beatport OAuth Setup

## Quick Start

### 1. Add to your Django settings.py

```python
INSTALLED_APPS = (
    # ... your existing apps
    'oauth2_provider',
    'beatport_oauth',  # the app we create below
)

# OAuth2 Toolkit settings
OAUTH2_PROVIDER = {
    'SCOPES': {
        'read': 'Read scope',
        'write': 'Write scope',
    },
    'ACCESS_TOKEN_EXPIRE_SECONDS': 3600,
}
```

### 2. Add to your urls.py

```python
from django.urls import include, path
from beatport_oauth import views as beatport_views

urlpatterns = [
    path('o/', include('oauth2_provider.urls', namespace='oauth2_provider')),
    path('beatport/', include('beatport_oauth.urls')),
]
```

### 3. Run migrations

```bash
python manage.py migrate oauth2_provider
```

---

## What This Gives You

`django-oauth-toolkit` makes your Django app an **OAuth2 provider**. This means:

- Other apps can get tokens from your Django app
- Your Django app issues and validates tokens
- You control who can access what

**But for Beatport**, you need to be an **OAuth2 client**, not a provider. Beatport is the provider. Your app requests tokens from Beatport.

So `django-oauth-toolkit` is the wrong tool for Beatport OAuth.

---

## The Right Way: Django as OAuth Client (for Beatport)

Instead of `django-oauth-toolkit`, use `requests-oauthlib` or plain `requests`:

### Install

```bash
pip install requests-oauthlib
```

### Minimal Django app for Beatport OAuth

Create `beatport_oauth/views.py`:

```python
import os
import requests
from django.shortcuts import redirect
from django.http import JsonResponse
from django.conf import settings

BEATPORT_AUTH_URL = "https://api.beatport.com/v4/auth/oauth/authorize"
BEATPORT_TOKEN_URL = "https://api.beatport.com/v4/auth/oauth/token"


def beatport_auth(request):
    """Redirect user to Beatport OAuth login."""
    client_id = settings.BEATPORT_CLIENT_ID
    redirect_uri = settings.BEATPORT_REDIRECT_URI
    
    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": "",  # Beatport uses empty scope
    }
    url = f"{BEATPORT_AUTH_URL}?" + "&".join(f"{k}={v}" for k, v in params.items())
    return redirect(url)


def beatport_callback(request):
    """Handle OAuth callback from Beatport."""
    code = request.GET.get("code")
    error = request.GET.get("error")
    
    if error:
        return JsonResponse({"error": error}, status=400)
    
    if not code:
        return JsonResponse({"error": "No code provided"}, status=400)
    
    # Exchange code for token
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.BEATPORT_REDIRECT_URI,
        "client_id": settings.BEATPORT_CLIENT_ID,
        "client_secret": settings.BEATPORT_CLIENT_SECRET,
    }
    
    res = requests.post(BEATPORT_TOKEN_URL, data=data)
    
    if not res.ok:
        return JsonResponse({"error": res.text}, status=res.status_code)
    
    token_data = res.json()
    
    # Save token to your model (example)
    # BeatportToken.objects.create(
    #     user=request.user,
    #     access_token=token_data["access_token"],
    #     refresh_token=token_data.get("refresh_token"),
    #     expires_at=timezone.now() + timedelta(seconds=token_data["expires_in"]),
    # )
    
    return JsonResponse({
        "success": True,
        "token_type": token_data.get("token_type"),
        "expires_in": token_data.get("expires_in"),
    })
```

### Create `beatport_oauth/urls.py`:

```python
from django.urls import path
from . import views

urlpatterns = [
    path('auth/', views.beatport_auth, name='beatport_auth'),
    path('callback/', views.beatport_callback, name='beatport_callback'),
]
```

### Add to `settings.py`:

```python
BEATPORT_CLIENT_ID = os.getenv("BEATPORT_CLIENT_ID", "")
BEATPORT_CLIENT_SECRET = os.getenv("BEATPORT_CLIENT_SECRET", "")
BEATPORT_REDIRECT_URI = "http://localhost:8000/beatport/callback/"
```

### Add to `urls.py`:

```python
path('beatport/', include('beatport_oauth.urls')),
```

---

## Summary

| Tool | Purpose | For Beatport? |
|------|---------|-------------|
| `django-oauth-toolkit` | Makes your Django app an OAuth **provider** | ❌ Not needed |
| `requests-oauthlib` | Makes your Django app an OAuth **client** | ✅ Use this |
| Plain `requests` | Manual HTTP calls | ✅ Works fine |

**django-oauth-toolkit** is only useful if you want OTHER apps to log in via YOUR Django app. For Beatport, you need to log in to THEIR app. So you need a client, not a provider.

You probably installed the wrong package. `django-oauth-toolkit` won't help with Beatport OAuth. Use `requests` or `requests-oauthlib` instead.

Want me to create the full Django app structure for Beatport OAuth client?
