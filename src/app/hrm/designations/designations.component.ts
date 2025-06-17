import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DesignationService } from '../../services/designation.service';
import { DepartmentService } from '../../services/department.service';

@Component({
  selector: 'app-designations',
  templateUrl: './designations.component.html',
  styleUrls: ['./designations.component.scss']
})
export class DesignationsComponent implements OnInit {
  designationForm!: FormGroup;
  showPopup = false;
  isEditMode = false;
  editingId: string | null = null;

  designations: any[] = [];
  departments: any[] = [];

  constructor(
    private fb: FormBuilder,
    private designationService: DesignationService,
    private departmentService: DepartmentService
  ) {}

  ngOnInit(): void {
    this.initForm();

    this.designationService.getDesignations().subscribe(data => {
      this.designations = data;
    });

    this.departmentService.getDepartments().subscribe(data => {
      this.departments = data;
    });
  }

  initForm(): void {
    this.designationForm = this.fb.group({
      designation: ['', Validators.required],
      description: [''],
      department: ['', Validators.required]
    });
  }

  openPopup(): void {
    this.showPopup = true;
    this.isEditMode = false;
    this.editingId = null;
    this.designationForm.reset();
  }

  closePopup(): void {
    this.showPopup = false;
  }

  saveDesignation(): void {
    if (this.designationForm.invalid) return;

    const formData = this.designationForm.value;

    if (this.isEditMode && this.editingId) {
      this.designationService.updateDesignation(this.editingId, formData).then(() => this.closePopup());
    } else {
      this.designationService.addDesignation(formData).then(() => this.closePopup());
    }
  }

  editDesignation(item: any): void {
    this.designationForm.patchValue({
      designation: item.designation,
      description: item.description,
      department: item.department
    });
    this.isEditMode = true;
    this.editingId = item.id;
    this.showPopup = true;
  }

  deleteDesignation(id: string): void {
    if (confirm('Are you sure you want to delete this designation?')) {
      this.designationService.deleteDesignation(id);
    }
  }
}
