import axios, { AxiosResponse } from 'axios'
import { api } from 'src/boot/axios.ts'
import { UploadedFile } from 'src/types'

interface FileUploadResponse {
  file: UploadedFile;
  uploadSignedUrl: string;
}

export async function apiFilesGetPreSigned (fileUpload: {
  fileName: string;
  fileSize: number;
}): Promise<AxiosResponse<FileUploadResponse>> {
  return api.post('/api/v1/files/upload', fileUpload).then()
}

export function apiFilesUpload (formData: FormData): Promise<AxiosResponse> {
  return api.post('/api/v1/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// Function to handle the entire file upload process
export async function apiUploadFileToS3 (file: File): Promise<UploadedFile> {
  try {
    const response = await apiFilesGetPreSigned({
      fileName: file.name,
      fileSize: file.size
    })

    const { file: uploadedFile, uploadSignedUrl } = response.data
    await axios.put(uploadSignedUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    })

    return uploadedFile
  } catch (error) {
    console.error('Error during file upload:', error)
    throw error
  }
}
