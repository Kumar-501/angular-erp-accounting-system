import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ModifierService } from '../services/modifier.service';

interface Modifier {
  id: string;
  modifierSet: string;
  modifiers: { name: string; price: number }[];
  products?: string;
}

@Component({
  selector: 'app-modifier',
  templateUrl: './modifier.component.html',
  styleUrls: ['./modifier.component.scss']
})
export class ModifierComponent implements OnInit {
  isModalOpen: boolean = false;
  modifierForm: FormGroup;
  modifiersData: Modifier[] = [];
  searchQuery: string = '';
  editingModifierId: string | null = null;
  
  constructor(private fb: FormBuilder, private modifierService: ModifierService) {
    this.modifierForm = this.fb.group({
      modifierSet: ['', Validators.required],
      modifiers: this.fb.array([
        this.createModifierGroup()
      ])
    });
  }

  ngOnInit(): void {
    this.loadModifiers();
  }

  private createModifierGroup(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]]
    });
  }

  private loadModifiers(): void {
    this.modifierService.getModifiers().subscribe(modifiers => {
      this.modifiersData = modifiers.map(modifier => ({
        ...modifier,
        id: modifier.id || ''
      }));
    });
  }

  get modifiers(): FormArray {
    return this.modifierForm.get('modifiers') as FormArray;
  }

  addModifier(): void {
    this.modifiers.push(this.createModifierGroup());
  }

  removeModifier(index: number): void {
    if (this.modifiers.length > 1) {
      this.modifiers.removeAt(index);
    }
  }

  saveModifier(): void {
    if (this.modifierForm.invalid) {
      this.markFormGroupTouched(this.modifierForm);
      return;
    }

    const formData = this.modifierForm.value;
    const modifierData = {
      modifierSet: formData.modifierSet,
      modifiers: formData.modifiers
    };

    if (this.editingModifierId) {
      this.modifierService.updateModifier(this.editingModifierId, modifierData)
        .then(() => {
          alert("Modifier updated successfully!");
          this.resetForm();
        })
        .catch(error => {
          console.error("Error updating modifier:", error);
          alert("Error updating modifier");
        });
    } else {
      this.modifierService.addModifier(modifierData)
        .then(() => {
          alert("Modifier saved successfully!");
          this.resetForm();
        })
        .catch(error => {
          console.error("Error saving modifier:", error);
          alert("Error saving modifier");
        });
    }
  }

  editModifier(id: string): void {
    const modifier = this.modifiersData.find(m => m.id === id);
    if (!modifier) return;

    this.editingModifierId = id;
    
    // Clear existing modifiers
    while (this.modifiers.length) {
      this.modifiers.removeAt(0);
    }

    // Set form values
    this.modifierForm.patchValue({
      modifierSet: modifier.modifierSet
    });

    // Add modifier groups
    modifier.modifiers.forEach(mod => {
      this.modifiers.push(this.fb.group({
        name: [mod.name, Validators.required],
        price: [mod.price, [Validators.required, Validators.min(0)]]
      }));
    });

    this.openModal();
  }

  deleteModifier(id: string): void {
    if (confirm('Are you sure you want to delete this modifier?')) {
      this.modifierService.deleteModifier(id)
        .then(() => {
          alert("Modifier deleted successfully!");
        })
        .catch(error => {
          console.error("Error deleting modifier:", error);
          alert("Error deleting modifier");
        });
    }
  }

  openModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.modifierForm.reset();
    while (this.modifiers.length) {
      this.modifiers.removeAt(0);
    }
    this.modifiers.push(this.createModifierGroup());
    this.editingModifierId = null;
    this.isModalOpen = false;
  }

  filteredModifiers(): Modifier[] {
    if (!this.searchQuery.trim()) {
      return this.modifiersData;
    }
    const query = this.searchQuery.toLowerCase();
    return this.modifiersData.filter(modifier =>
      modifier.modifierSet.toLowerCase().includes(query) ||
      modifier.modifiers.some(m => m.name.toLowerCase().includes(query))
    );
  }

  getFormattedModifiers(modifier: Modifier): string {
    return modifier.modifiers.map(m => m.name).join(', ');
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
