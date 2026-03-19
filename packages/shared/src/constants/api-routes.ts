export const API_ROUTES = {
  AUTH: {
    LOGIN: '/api/auth/login',
  },
  USERS: {
    ME: '/api/users/me',
    FCM_TOKEN: '/api/users/me/fcm-token',
  },
  LOCATIONS: {
    REQUEST: '/api/locations/request',
    RESPOND: '/api/locations/respond',
    LATEST: '/api/locations/latest',
  },
  CASES: {
    CREATE: '/api/cases',
    MY: '/api/cases/my',
    ASSIGN: (id: number) => `/api/cases/${id}/assign`,
    SURVEY: (id: number) => `/api/cases/${id}/survey`,
    REVIEW_LIST: '/api/cases/review',
    DETAIL: (id: number) => `/api/cases/${id}/detail`,
    REVIEW: (id: number) => `/api/cases/${id}/review`,
  },
  UPLOAD: '/api/upload',
} as const;
