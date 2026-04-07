# GitHub Device Flow Authentication - Audit Report

**Date:** April 4, 2026
**Target Repository:** `docs/references/github-repos/GitHub-Store`
**Objective:** Analyze the GitHub OAuth authentication architecture from the `GitHub-Store` repository and outline how to adapt it to the `adb-gui-next` Tauri/React architecture.

## 1. Overview of the Device Flow Architecture

The `GitHub-Store` project utilizes the **GitHub Device Authorization Flow** (RFC 8628), which is ideal for desktop and mobile applications that don't have safe, direct access to a web browser callback server. Instead of a hard callback chain, the application prompts the user to visit a GitHub URL on any device and enter a short code.

### 1.1 Key Endpoints
The authentication relies on two HTTP endpoints:

1. **Start Flow (`POST https://github.com/login/device/code`)**
   - **Payload**: `client_id` (application/x-www-form-urlencoded)
   - **Response**: Yields `device_code`, `user_code` (e.g., `ABCD-EFGH`), `verification_uri` (usually `https://github.com/login/device`), `expires_in` (seconds), and `interval` (seconds).
2. **Poll for Token (`POST https://github.com/login/oauth/access_token`)**
   - **Payload**: `client_id`, `device_code`, `grant_type=urn:ietf:params:oauth:grant-type:device_code` (application/x-www-form-urlencoded)
   - **Response**: Either succeeds yielding `access_token` or returns JSON with an `error` body (e.g., `authorization_pending`, `slow_down`, `expired_token`).

## 2. Deep Dive: `GitHub-Store` Implementation

The Kotlin Multiplatform implementation separates concerns beautifully across network, repository, and view-model layers:

### 2.1 The Network Layer (`GitHubAuthApi.kt`)
- Uses `Ktor HttpClient` with `FormDataContent` encoding for `application/x-www-form-urlencoded`.
- Implements custom retry logic `withRetry(maxAttempts, initialDelay...)` for the initiation request to absorb transient network failures.
- Captures all `HttpTimeout` scenarios cleanly to avoid crashes.

### 2.2 The Repository Layer (`AuthenticationRepositoryImpl.kt`)
This layer implements robust error parsing and polling logic:
- **`awaitDeviceToken` (Continuous Polling)**:
  - Automatically loops using `delay(pollingInterval)` while `isActive`.
  - Parses specific GitHub strings from the error payload:
    - `"authorization_pending"`: Resets error counters and continues to wait.
    - `"slow_down"`: **Critical step**. GitHub asks the app to back off. The implementation automatically adds 5000ms (`pollingInterval += 5000`) to the wait time.
    - `"access_denied"`: The user actively rejected the OAuth prompt.
    - `"expired_token"` / `"expired_device_code"`: The window (usually 15m) elapsed.
  - Limits unknown or network errors (consecutive logic) avoiding infinitely thrashing an offline device.
- **`saveTokenWithVerification`**: Explicitly reads the token back out of the local DataStore after writing to ensure persistence worked before resolving success.

### 2.3 The UI Layer (`AuthenticationViewModel.kt`)
State explicitly dictates UI transitions:
- `LoggedOut` -> `Pending` (Loading code) -> `DevicePrompt` (Display code/URI + Polling active) -> `LoggedIn`
- Allows the UI to update the countdown to expiration.

## 3. Adapting to `adb-gui-next` (Tauri + React)

Our `adb-gui-next` project already features the backend Tauri command stubs: `MarketplaceGithubDeviceStart` and `MarketplaceGithubDevicePoll`. 

### Recommended Implementation Roadmap:

#### Step 1: Rust Backend Validation (Tauri)
- Ensure that `marketplace_github_device_poll` in `marketplace.rs` does **not** implement its own blocking loop. It should map purely to the single HTTP call (like `pollDeviceTokenOnce` in KMP) so the frontend can orchestrate polling asynchronously.
- The Rust backend must return exact error constants (`authorization_pending`, `slow_down`) back to the IPC bridge so React can process them.

#### Step 2: React State Machine
- Use Zustand (`marketplaceStore.ts`) to track the auth state:
  ```ts
  type AuthState = 'idle' | 'fetching_code' | 'awaiting_user' | 'success' | 'error';
  ```
- Store the `deviceCode`, `userCode`, and `verificationUri` in the store temporarily while `authState === 'awaiting_user'`.

#### Step 3: Frontend Polling Loop (Custom Hook or Async Action)
Implement the polling loop inside a Zustand action or a robust React Hook (`useGithubDeviceFlow`):
- Start an asynchronous `while` loop or `setInterval`.
- Read the `interval` property provided by `startDeviceFlow`.
- Invoke `MarketplaceGithubDevicePoll`.
- If `error === 'authorization_pending'`, wait for `interval` seconds and repeat.
- If `error === 'slow_down'`, take the current `interval`, increase it by 5 seconds, and repeat.
- If `access_token` is present, stop polling, close the dialog, trigger `toast.success`, and save the token securely into the application configuration / LocalStorage / secure secure element.

#### Step 4: UI Build (React Components)
Build a `GithubAuthDialog` that conditionally replaces the legacy PAT input:
1. When mounted, trigger `startDeviceFlow`.
2. Present the user with a large, selectable `user_code`.
3. Provide a one-click button "Open GitHub in Browser" pointing to `verificationUri`.
4. Underneath, display a Spinner with text "Waiting for your authorization in the browser..."
5. Display expiration countdown logic to fail gracefully.

## Conclusion
The Device Flow is an excellent, secure authentication matrix for Desktop platforms like Tauri. By replicating the `GitHub-Store` fail-safes—specifically `slow_down` handling, exponential backoff for network errors, and asynchronous UI polling loops—we can deliver an extraordinarily polished GitHub login experience within `adb-gui-next`.
