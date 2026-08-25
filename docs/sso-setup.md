# Enterprise Single Sign-On (SAML 2.0 / OIDC) Setup Guide

AgentWatch supports Enterprise Single Sign-On via SAML 2.0 and OIDC for centralized authentication, automated user provisioning (JIT), and identity governance.

---

## 1. Prerequisites & SP Metadata

Before configuring your Identity Provider (IdP), obtain your AgentWatch Service Provider (SP) coordinates:

| Parameter | Value |
| :--- | :--- |
| **Assertion Consumer Service (ACS) URL** | `https://app.agentwatch.dev/api/auth/sso/saml/callback` |
| **Entity ID / Audience URI** | `https://app.agentwatch.dev/api/auth/sso/saml/metadata` |
| **Name ID Format** | `EmailAddress` (`urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`) |
| **Binding** | `HTTP-POST` |

---

## 2. Identity Provider (IdP) Setup

### Option A: Okta SAML 2.0

1. **Create Application in Okta Admin Console**:
   - Navigate to **Applications** $\rightarrow$ **Applications** $\rightarrow$ **Create App Integration**.
   - Select **SAML 2.0** and click **Next**.
   - Set **App name** to `AgentWatch`.

2. **Configure SAML Settings**:
   - **Single sign-on URL**: `https://app.agentwatch.dev/api/auth/sso/saml/callback`
   - Check *Use this for Recipient URL and Destination URL*.
   - **Audience URI (SP Entity ID)**: `https://app.agentwatch.dev/api/auth/sso/saml/metadata`
   - **Name ID format**: `EmailAddress`
   - **Application username**: `Email`

3. **Attribute Statements (Optional for JIT Provisioning)**:
   - `email` $\rightarrow$ `user.email`
   - `firstName` $\rightarrow$ `user.firstName`
   - `lastName` $\rightarrow$ `user.lastName`
   - `role` $\rightarrow$ `appuser.role` (or custom group mapping)

4. **Copy Details to AgentWatch**:
   - In Okta, go to **Sign On** $\rightarrow$ **SAML 2.0** $\rightarrow$ **Metadata details**.
   - Copy **Sign On URL**, **Issuer (Entity ID)**, and download the **X.509 Certificate**.
   - Paste these values into AgentWatch under **Settings** $\rightarrow$ **Enterprise SSO**.

---

### Option B: Microsoft Entra ID (Azure AD)

1. **Create Enterprise Application**:
   - Navigate to **Azure Portal** $\rightarrow$ **Microsoft Entra ID** $\rightarrow$ **Enterprise applications** $\rightarrow$ **New application** $\rightarrow$ **Create your own application**.
   - Name it `AgentWatch` and choose *Integrate any other application you don't find in the gallery (Non-gallery)*.

2. **Set up Single Sign-On**:
   - Select **Single sign-on** $\rightarrow$ **SAML**.
   - **Basic SAML Configuration**:
     - **Identifier (Entity ID)**: `https://app.agentwatch.dev/api/auth/sso/saml/metadata`
     - **Reply URL (ACS URL)**: `https://app.agentwatch.dev/api/auth/sso/saml/callback`
     - **Sign on URL (optional)**: `https://app.agentwatch.dev/login`

3. **Attributes & Claims**:
   - Unique User Identifier $\rightarrow$ `user.userprincipalname` (or `user.mail`)
   - `email` $\rightarrow$ `user.mail`
   - `givenname` $\rightarrow$ `user.givenname`
   - `surname` $\rightarrow$ `user.surname`

4. **SAML Certificates**:
   - Download **Certificate (Base64)** and copy **Login URL** and **Microsoft Entra Identifier**.
   - Paste into AgentWatch under **Settings** $\rightarrow$ **Enterprise SSO**.

---

### Option C: Google Workspace

1. **Add Custom SAML App**:
   - Go to Google Admin Console $\rightarrow$ **Apps** $\rightarrow$ **Web and mobile apps** $\rightarrow$ **Add app** $\rightarrow$ **Add custom SAML app**.
   - Name it `AgentWatch`.

2. **Service Provider Details**:
   - **ACS URL**: `https://app.agentwatch.dev/api/auth/sso/saml/callback`
   - **Entity ID**: `https://app.agentwatch.dev/api/auth/sso/saml/metadata`
   - **Name ID**: `Basic Information > Primary email` (Format: `EMAIL`)

3. **Attribute Mapping**:
   - `email` $\rightarrow$ `Primary email`
   - `first_name` $\rightarrow$ `First name`
   - `last_name` $\rightarrow$ `Last name`

---

## 3. Enforcing SSO

Once your test handshake succeeds on `/settings/sso`:
1. Toggle **Enforce SSO for all organization members**.
2. Any user attempting password or social login with an email matching your verified domain (`@acme.com`) will be automatically routed through your corporate Identity Provider.
