// src/app/session.ts
export class SessionStorage {
    static saveUser(user: any): void {
      localStorage.setItem('currentUser', JSON.stringify(user));
    }
  
    static getUser(): any {
      const data = localStorage.getItem('currentUser');
      return data ? JSON.parse(data) : null;
    }
  
    static clear(): void {
      localStorage.removeItem('currentUser');
    }
  
    static isLoggedIn(): boolean {
      return !!this.getUser();
    }
  }
  