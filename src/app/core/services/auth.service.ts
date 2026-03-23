import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SocialAuthService, GoogleLoginProvider, SocialUser } from '@abacritt/angularx-social-login';
import { environment } from '@env/environment';
import { tap, catchError, of } from 'rxjs';

interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private socialAuthService = inject(SocialAuthService);

  currentUser = signal<any>(null);
  private tokenKey = 'sf_auth_token';
  private userDataKey = 'sf_user_data';

  constructor() {
    this.loadStoredAuth();
    
    // Listen for social login updates
    this.socialAuthService.authState.subscribe((user) => {
      if (user && user.idToken) {
        this.loginWithGoogle(user.idToken).subscribe();
      }
    });
  }

  private loadStoredAuth() {
    const token = localStorage.getItem(this.tokenKey);
    const userData = localStorage.getItem(this.userDataKey);
    
    if (token && userData) {
      this.currentUser.set(JSON.parse(userData));
    }
  }

  loginWithGoogle(idToken: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/google`, { token: idToken })
      .pipe(
        tap(res => {
          this.setAuth(res.access_token, res.user);
          this.router.navigate(['/dashboard']);
        }),
        catchError(err => {
          console.error('Login error', err);
          return of(null);
        })
      );
  }

  private setAuth(token: string, user: any) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userDataKey, JSON.stringify(user));
    this.currentUser.set(user);
  }

  updateLocalProfile(name: string) {
    const user = this.currentUser();
    if (user) {
      const updatedUser = { ...user, name };
      localStorage.setItem(this.userDataKey, JSON.stringify(updatedUser));
      this.currentUser.set(updatedUser);
    }
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userDataKey);
    this.currentUser.set(null);
    this.socialAuthService.signOut();
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && token !== 'null' && token !== 'undefined';
  }
}
