import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DepartmentService } from '../../services/department.service';

@Component({
  selector: 'app-departments',
  templateUrl: './departments.component.html',
  styleUrls: ['./departments.component.scss']
})
export class DepartmentsComponent implements OnInit {
  departments: any[] = [];
  showPopup = false;
  isEditMode = false;
  editingDeptId: string | null = null;

  departmentForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private departmentService: DepartmentService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.departmentService.getDepartments().subscribe(data => {
      this.departments = data;
    });
  }

  initForm(): void {
    this.departmentForm = this.fb.group({
      department: ['', Validators.required],
      departmentId: [''],
      description: ['']
    });
  }

  generateDeptId(): string {
    return 'DEPT-' + Math.floor(1000 + Math.random() * 9000);
  }

  openPopup(): void {
    this.showPopup = true;
    this.isEditMode = false;
    this.editingDeptId = null;
    this.departmentForm.reset();
    this.departmentForm.patchValue({ departmentId: this.generateDeptId() });
  }

  closePopup(): void {
    this.showPopup = false;
  }

  saveDepartment(): void {
    if (this.departmentForm.invalid) return;

    const deptData = this.departmentForm.value;

    if (this.isEditMode && this.editingDeptId) {
      this.departmentService.updateDepartment(this.editingDeptId, deptData).then(() => {
        this.closePopup();
      });
    } else {
      this.departmentService.addDepartment(deptData).then(() => {
        this.closePopup();
      });
    }
  }

  editDepartment(dept: any): void {
    this.departmentForm.patchValue({
      department: dept.department,
      departmentId: dept.departmentId,
      description: dept.description
    });
    this.isEditMode = true;
    this.editingDeptId = dept.id;
    this.showPopup = true;
  }

  deleteDepartment(id: string): void {
    if (confirm('Are you sure you want to delete this department?')) {
      this.departmentService.deleteDepartment(id);
    }
  }
}
