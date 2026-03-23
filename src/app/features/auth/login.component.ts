import { Component, inject } from '@angular/core';

import { 
  GoogleSigninButtonModule,
  SocialAuthService 
} from '@abacritt/angularx-social-login';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [GoogleSigninButtonModule],
    template: `
    <div class="login-container">
      <div class="login-card">
        <div class="logo">
          <h1 class="brand-title">Smart Fuel</h1>
        </div>
        <p class="subtitle">Gestión inteligente de combustible</p>
        
        <div class="google-btn-wrapper">
          <asl-google-signin-button type="standard" shape="rectangular" text="signin_with" size="large"></asl-google-signin-button>
        </div>
        
        <p class="footer-note">Inicia sesión con tu cuenta de Google para continuar</p>
      </div>
    </div>
  `,
    styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: var(--surface);
      background-image: 
        radial-gradient(circle at 20% 10%, rgba(0, 108, 83, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 80% 90%, rgba(73, 94, 142, 0.08) 0%, transparent 40%);
    }
    .login-card {
      background: white;
      padding: 3rem 2rem;
      border-radius: 32px;
      text-align: center;
      max-width: 420px;
      width: calc(100% - 48px);
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.08);
      border: 1px solid rgba(0, 0, 0, 0.03);
    }
    .brand-title {
      font-family: var(--font-headline);
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--primary);
      margin-bottom: 0.5rem;
      letter-spacing: -0.03em;
    }
    .subtitle {
      font-family: var(--font-body);
      color: var(--on-surface-variant);
      margin-bottom: 3rem;
      font-size: 1.1rem;
      font-weight: 500;
    }
    .google-btn-wrapper {
      display: flex;
      justify-content: center;
      margin-bottom: 2rem;
    }
    .footer-note {
      font-size: 0.85rem;
      color: var(--on-surface-variant);
      opacity: 0.8;
    }
  `]
})
export class LoginComponent {
  authService = inject(AuthService);
}
