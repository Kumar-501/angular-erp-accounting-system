// sales-targets.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { UserService } from '../../services/user.service';
import { TargetService, SalesTarget, TargetRange } from '../../services/target.service';
import { forkJoin, of, Subscription } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

@Component({
  selector: 'app-sales-targets',
  templateUrl: './sales-targets.component.html',
  styleUrls: ['./sales-targets.component.scss']
})
export class SalesTargetsComponent implements OnInit, OnDestroy {
  users: any[] = [];
  userTargets: { [userId: string]: SalesTarget } = {};
  isLoading = true;
  private targetsSubscription: Subscription | null = null;
  
  // Modal properties
  showTargetModal = false;
  selectedUser: any = null;
  targetRanges: TargetRange[] = [];
  
  constructor(
    private userService: UserService,
    private targetService: TargetService
  ) {}

  ngOnInit(): void {
    this.loadUsersAndTargets();
  }

  ngOnDestroy(): void {
    if (this.targetsSubscription) {
      this.targetsSubscription.unsubscribe();
    }
  }
  
  loadUsersAndTargets(): void {
    this.isLoading = true;
    
    this.userService.getUsers().pipe(
      switchMap(users => {
        this.users = users;
        
        // Set up real-time listener for targets
        this.setupTargetsListener();
        
        return of(null); // Return an observable to complete the chain
      })
    ).subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading users:', error);
        this.isLoading = false;
      }
    });
  }

  setupTargetsListener(): void {
    // Unsubscribe from previous subscription if exists
    if (this.targetsSubscription) {
      this.targetsSubscription.unsubscribe();
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    this.targetsSubscription = this.targetService.getTargetsSnapshot().subscribe({
      next: (targets: SalesTarget[]) => {
        // Clear existing targets
        this.userTargets = {};
        
        // Process the targets data
        targets.forEach(target => {
          // Filter for current month targets
          if (target.year === year && target.month === month) {
            this.userTargets[target.userId] = target;
          }
        });
      },
      error: (error: any) => {
        console.error('Error in targets snapshot:', error);
      }
    });
  }

  openTargetModal(user: any): void {
    this.selectedUser = user;
    this.showTargetModal = true;
    
    // Check if user already has target ranges
    const userTarget = this.userTargets[user.id];
    if (userTarget && userTarget.targetRanges && userTarget.targetRanges.length > 0) {
      // Clone the existing target ranges to avoid modifying the original
      this.targetRanges = userTarget.targetRanges.map(range => ({
        fromAmount: range.fromAmount,
        toAmount: range.toAmount,
        commissionPercent: range.commissionPercent
      }));
    } else {
      // Initialize with one empty target range
      this.targetRanges = [
        { fromAmount: 0, toAmount: 0, commissionPercent: 0 }
      ];
    }
  }
  
  closeTargetModal(): void {
    this.showTargetModal = false;
    this.selectedUser = null;
    this.targetRanges = [];
  }

  addTargetRange(): void {
    this.targetRanges.push({ fromAmount: 0, toAmount: 0, commissionPercent: 0 });
  }

  removeTargetRange(index: number): void {
    if (this.targetRanges.length > 1) {
      this.targetRanges.splice(index, 1);
    }
  }

  saveTargetRanges(): void {
    if (!this.selectedUser) return;
    
    const userId = this.selectedUser.id;
    const username = this.selectedUser.username || this.selectedUser.name || this.selectedUser.email;
    
    // Validate ranges
    const validRanges = this.targetRanges.filter(range => 
      !isNaN(range.fromAmount) && 
      !isNaN(range.toAmount) && 
      !isNaN(range.commissionPercent)
    );
    
    if (validRanges.length === 0) {
      console.error('No valid target ranges provided');
      return;
    }
    
    // Calculate overall target value (highest toAmount)
    const targetValue = validRanges.reduce((max, range) => 
      Math.max(max, range.toAmount), 0);
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    
    const targetData = {
      userId: userId,
      username: username,
      targetValue: targetValue,
      year: year,
      month: month,
      quarter: quarter,
      period: `${year}-${month.toString().padStart(2, '0')}`,
      targetRanges: validRanges,
      updatedAt: new Date()
    };
    
    if (this.userTargets[userId] && this.userTargets[userId].id) {
      // Update existing target
      this.targetService.updateTarget(this.userTargets[userId].id, targetData)
        .then(() => {
          console.log(`Target updated for user ${userId}`);
          this.closeTargetModal();
        })
        .catch(error => {
          console.error('Error updating target:', error);
        });
    } else {
      // Create new target
      const newTarget = {
        ...targetData,
        currentValue: 0,
        isAchieved: false,
        createdAt: new Date()
      };
      
      this.targetService.addTarget(newTarget)
        .then(() => {
          console.log(`New target created for user ${userId}`);
          this.closeTargetModal();
        })
        .catch(error => {
          console.error('Error creating target:', error);
        });
    }
  }

  hasTarget(userId: string): boolean {
    return this.userTargets[userId] !== undefined;
  }

  getTargetRanges(userId: string): TargetRange[] {
    return this.userTargets[userId]?.targetRanges || [];
  }
  
  getCurrentValue(userId: string): number {
    return this.userTargets[userId]?.currentValue || 0;
  }
  
  getTargetValue(userId: string): number {
    return this.userTargets[userId]?.targetValue || 0;
  }
  
  getAchievementPercentage(userId: string): number {
    const target = this.userTargets[userId];
    if (!target || !target.targetValue || target.targetValue === 0) {
      return 0;
    }
    
    const currentValue = target.currentValue || 0;
    return Math.min(100, Math.round((currentValue / target.targetValue) * 100));
  }
  
  isTargetAchieved(userId: string): boolean {
    return this.userTargets[userId]?.isAchieved || false;
  }
}