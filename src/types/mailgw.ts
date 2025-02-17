export type Token = {
  id: string
  token: string
}

export interface MailGWWrapper<T> {
  "@context": string
  "@id": string
  "@type": string
  "hydra:member": T[]
  "hydra:totalItems": number
}

export interface Domain {
  "@id": string
  "@type": string
  id: string
  domain: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}


export interface MailAccount {
  "@context": string
  "@id": string
  "@type": string
  id: string
  address: string
  quota: number
  used: number
  isDisabled: boolean
  isDeleted: boolean
  createdAt: string
  retentionAt: string
  updatedAt: string
}

export interface MailMessage {
  "@id": string
  "@type": string
  id: string
  accountId: string
  msgid: string
  from: {
    address: string
    name: string
  }
  to: {
    address: string
    name: string
  }[]
  subject: string
  intro: string
  seen: boolean
  isDeleted: boolean
  hasAttachments: boolean
  size: number
  downloadUrl: string
  createdAt: string
  updatedAt: string
}