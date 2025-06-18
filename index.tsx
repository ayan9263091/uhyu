// src/pages/index.tsx
import Head from 'next/head'
import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { writeBinaryFile, readBinaryFile, BaseDirectory } from '@tauri-apps/api/fs'
import { listen } from '@tauri-apps/api/event'
import '../styles/compressor.css'

export default function Home() {
  useEffect(() => {
    const dz = document.getElementById('dropzone')!
    const fileInput = document.getElementById('videoFile') as HTMLInputElement
    const cards = document.querySelectorAll<HTMLDivElement>('.card')
    const compressBtn = document.getElementById('compressBtn')!
    const uploadFill = document.getElementById('uploadFill')!
    const downloadFill = document.getElementById('downloadFill')!

    // Dropzone handlers
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('hover'); })
    dz.addEventListener('dragleave', () => dz.classList.remove('hover'))
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('hover')
      if (e.dataTransfer.files[0]) fileInput.files = e.dataTransfer.files
    })
    dz.querySelector('button')!
      .addEventListener('click', () => fileInput.click())

    // Quality card toggle
    cards.forEach(c => c.addEventListener('click', () => {
      cards.forEach(x => x.classList.remove('selected'))
      c.classList.add('selected')
    }))

    // Compress button → Tauri invoke
    compressBtn.addEventListener('click', async () => {
      if (!fileInput.files?.length) return alert('Please select a video first.')
      const file = fileInput.files[0]
      const quality = document.querySelector('.card.selected')!.getAttribute('data-quality')!

      // 1) Write input file to temp dir
      const buffer = await file.arrayBuffer()
      const tempName = `input.${file.name.split('.').pop()}`
      await writeBinaryFile({
        path: tempName,
        contents: new Uint8Array(buffer),
        dir: BaseDirectory.Temp
      })

      // 2) Listen for progress events
      const unlisten = await listen<{ uploadPct: number, downloadPct: number }>(
        'compression-progress',
        e => {
          uploadFill.style.width   = `${e.payload.uploadPct}%`
          downloadFill.style.width = `${e.payload.downloadPct}%`
        }
      )

      try {
        // 3) Invoke Rust command
        const outPath: string = await invoke('compress_video', {
          input: tempName,
          quality
        })
        // 4) Read and download
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
    <>
      <Head>
        <title>Video Compressor UI</title>
        <meta charSet="UTF-8" />
      </Head>
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
            <div className="card selected" data-quality="high">
              <h4>High Quality</h4>
            </div>
            <div className="card" data-quality="medium">
              <h4>Medium Quality</h4>
            </div>
          </div>
        </div>

        {/* Compress button */}
        <button className="compress-btn" id="compressBtn">
          Compress Video
        </button>

        {/* Progress bars */}
        <div className="progress-container">
          <div className="progress-label">Upload Progress</div>
          <div className="progress-bar">
            <div id="uploadFill" className="progress-fill"></div>
          </div>
          <div className="progress-label">Download Progress</div>
          <div className="progress-bar">
            <div id="downloadFill" className="progress-fill"></div>
          </div>
        </div>
      </div>
    </>
  )
}
