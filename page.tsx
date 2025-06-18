// src/app/(root)/page.tsx
'use client'

import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { writeBinaryFile, readBinaryFile, BaseDirectory } from '@tauri-apps/api/fs'
import { listen } from '@tauri-apps/api/event'
import '../compressor.css'      // ← your new CSS

export default function Home() {
  useEffect(() => {
    const dz = document.getElementById('dropzone')!
    const fileInput = document.getElementById('videoFile') as HTMLInputElement
    const cards = document.querySelectorAll<HTMLDivElement>('.card')
    const compressBtn = document.getElementById('compressBtn')!
    const uploadFill = document.getElementById('uploadFill')!
    const downloadFill = document.getElementById('downloadFill')!

    // 1) Dropzone
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('hover') })
    dz.addEventListener('dragleave', () => dz.classList.remove('hover'))
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('hover')
      if (e.dataTransfer.files[0]) fileInput.files = e.dataTransfer.files
    })
    dz.querySelector('button')!.addEventListener('click', () => fileInput.click())

    // 2) Quality cards
    cards.forEach(c => c.addEventListener('click', () => {
      cards.forEach(x => x.classList.remove('selected'))
      c.classList.add('selected')
    }))

    // 3) Compress logic via Tauri
    compressBtn.addEventListener('click', async () => {
      if (!fileInput.files?.length) {
        alert('Please select a video first.')
        return
      }
      const file = fileInput.files[0]
      const quality = document.querySelector('.card.selected')!.dataset.quality!

      // write file to temp
      const buf = await file.arrayBuffer()
      const tempName = `input.${file.name.split('.').pop()}`
      await writeBinaryFile({ path: tempName, contents: new Uint8Array(buf), dir: BaseDirectory.Temp })

      // listen for progress
      const unlisten = await listen<{uploadPct:number,downloadPct:number}>(
        'compression-progress',
        e => {
          uploadFill.style.width = `${e.payload.uploadPct}%`
          downloadFill.style.width = `${e.payload.downloadPct}%`
        }
      )

      try {
        // invoke Rust command
        const outPath: string = await invoke('compress_video', { input: tempName, quality })
        // read back and download
        const compressed = await readBinaryFile({ path: outPath })
        const blob = new Blob([compressed.buffer], { type: file.type })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `compressed_${quality}.${file.name.split('.').pop()}`
        a.click()
      } catch (err) {
        alert('Compression failed: ' + err)
      } finally {
        unlisten()
      }
    })
  }, [])

  return (
    <div className="container">
      {/* Upload zone */}
      <div className="dropzone" id="dropzone">
        <div className="icon">☁️⬆️</div>
        <div className="title">Upload Your Video</div>
        <button type="button">Browse Files</button>
        <input type="file" id="videoFile" accept=".mp4,.mov" />
      </div>

      {/* Quality cards */}
      <div className="quality-group">
        <h3>Select Compression Quality</h3>
        <div className="cards">
          <div className="card selected" data-quality="high"><h4>High Quality</h4></div>
          <div className="card" data-quality="medium"><h4>Medium Quality</h4></div>
        </div>
      </div>

      {/* Compress button */}
      <button className="compress-btn" id="compressBtn">Compress Video</button>

      {/* Progress bars */}
      <div className="progress-container">
        <div className="progress-label">Upload Progress</div>
        <div className="progress-bar"><div id="uploadFill" className="progress-fill"></div></div>
        <div className="progress-label">Download Progress</div>
        <div className="progress-bar"><div id="downloadFill" className="progress-fill"></div></div>
      </div>
    </div>
  )
}
