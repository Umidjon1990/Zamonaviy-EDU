import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = "/api";

// Utility function for API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    // API dan aniq xato xabarini olish
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
        if (errorData.availableTeachers) {
          errorMessage += `. Mavjud o'qituvchilar: ${errorData.availableTeachers.join(", ")}`;
        }
        if (errorData.matchingTeachers) {
          errorMessage += `. Mos keluvchi o'qituvchilar: ${errorData.matchingTeachers.join(", ")}`;
        }
      }
    } catch {
      // JSON parse xatosi bo'lsa, default xabarni ishlatish
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ===== LEADS =====
export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: () => apiCall("/leads"),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiCall("/leads", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiCall(`/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });
}

// ===== STUDENTS =====
export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: () => apiCall("/students"),
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiCall("/students", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/students/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiCall(`/students/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// ===== SUBJECTS =====
export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: () => apiCall("/subjects"),
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiCall("/subjects", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/subjects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiCall(`/subjects/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

// ===== GROUPS =====
export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: () => apiCall("/groups"),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiCall("/groups", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiCall(`/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useImportGroupTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (template: string) => apiCall("/groups/import-template", { 
      method: "POST", 
      body: JSON.stringify({ template }) 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// ===== PAYMENTS =====
export function usePayments(studentId?: number) {
  return useQuery({
    queryKey: ["payments", studentId],
    queryFn: () => apiCall(`/payments${studentId ? `?studentId=${studentId}` : ""}`),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiCall("/payments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// ===== ATTENDANCE =====
export function useAttendance(groupId?: number, date?: string) {
  const params = new URLSearchParams();
  if (groupId) params.append("groupId", groupId.toString());
  if (date) params.append("date", date);
  
  return useQuery({
    queryKey: ["attendance", groupId, date],
    queryFn: () => apiCall(`/attendance${params.toString() ? `?${params.toString()}` : ""}`),
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiCall("/attendance", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

export function useUpdateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/attendance/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

// ===== TEACHERS =====
export function useTeachers() {
  return useQuery({
    queryKey: ["teachers"],
    queryFn: () => apiCall("/teachers"),
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiCall("/teachers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teachers"] }),
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/teachers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teachers"] }),
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiCall(`/teachers/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teachers"] }),
  });
}

// ===== STUDENT GROUPS =====
export function useAddStudentToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, groupId }: { studentId: number; groupId: number }) => 
      apiCall(`/students/${studentId}/groups`, { method: "POST", body: JSON.stringify({ groupId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

// ===== STATISTICS =====
export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => apiCall("/stats"),
  });
}
