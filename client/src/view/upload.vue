<template>
    <div class="break-point-upload">
        <h3>断点续传 VS 非断点续传</h3>
        <input type="file" ref="inputPart" class="file" @change="handleFile($event, 'part')">
        <div class="go-upload-trigger" @click="onClickTrigger">
            <svg t="1671939317490" class="upload-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2695" width="80" height="80"><path d="M896 629.333333c-17.066667 0-32 14.933333-32 32v170.666667c0 6.4-4.266667 10.666667-10.666667 10.666667H170.666667c-6.4 0-10.666667-4.266667-10.666667-10.666667v-170.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v170.666667c0 40.533333 34.133333 74.666667 74.666667 74.666667h682.666666c40.533333 0 74.666667-34.133333 74.666667-74.666667v-170.666667c0-17.066667-14.933333-32-32-32z" fill="#666666" p-id="2696"></path><path d="M322.133333 407.466667l157.866667-157.866667V704c0 17.066667 14.933333 32 32 32s32-14.933333 32-32V247.466667l157.866667 157.866666c6.4 6.4 14.933333 8.533333 23.466666 8.533334s17.066667-2.133333 23.466667-8.533334c12.8-12.8 12.8-32 0-44.8l-213.333333-213.333333c-12.8-12.8-32-12.8-44.8 0l-213.333334 213.333333c-12.8 12.8-12.8 32 0 44.8 10.666667 12.8 32 12.8 44.8 2.133334z" fill="#666666" p-id="2697"></path></svg>
        </div>
        <el-button type="primary" @click="handlePause">暂停</el-button>
        <el-button type="primary">继续</el-button>
        <el-progress v-if="percent > 0" :percentage="percent"></el-progress>
        <h1>chunk 上传进度列表</h1>
        <div v-for="item in partList" :key="item.chunkName">
            <div>{{ item.chunkName }}</div>
            <el-progress  :percentage="item.percent"></el-progress>
        </div>
        <div  class="line" />
        <div>非断点续传</div>
        <input type="file" ref="inputAll" class="file" @change="handleFile($event, 'all')">
        <div class="go-upload-trigger" @click="onClickAllTrigger">
            <svg t="1671939317490" class="upload-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2695" width="80" height="80"><path d="M896 629.333333c-17.066667 0-32 14.933333-32 32v170.666667c0 6.4-4.266667 10.666667-10.666667 10.666667H170.666667c-6.4 0-10.666667-4.266667-10.666667-10.666667v-170.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v170.666667c0 40.533333 34.133333 74.666667 74.666667 74.666667h682.666666c40.533333 0 74.666667-34.133333 74.666667-74.666667v-170.666667c0-17.066667-14.933333-32-32-32z" fill="#666666" p-id="2696"></path><path d="M322.133333 407.466667l157.866667-157.866667V704c0 17.066667 14.933333 32 32 32s32-14.933333 32-32V247.466667l157.866667 157.866666c6.4 6.4 14.933333 8.533333 23.466666 8.533334s17.066667-2.133333 23.466667-8.533334c12.8-12.8 12.8-32 0-44.8l-213.333333-213.333333c-12.8-12.8-32-12.8-44.8 0l-213.333334 213.333333c-12.8 12.8-12.8 32 0 44.8 10.666667 12.8 32 12.8 44.8 2.133334z" fill="#666666" p-id="2697"></path></svg>
        </div>
    </div>
</template>

<script>
import axios from 'axios'
import Worker from '../lib/generateHash.worker.js'

const DEFAULT_SIZE = 10 * 1024 * 1024
const HOST = 'http://localhost:3000'

export default {
    name: 'UploadComponent',
    data() {
        const controller = new AbortController();
        return {
            currentFile: null,
            percent: 0,
            worker: null,
            fileName: '',
            partList: [],
            controller
        }
    },
    mounted() {
        this.worker = new Worker()
    },
    destroyed() {
        this.worker.terminate()
    },
    methods: {
        onClickTrigger() {
            this.$refs.inputPart.click();
        },
        onClickAllTrigger() {
            this.$refs.inputAll.click();
        },
        handleFile(e, type) {
            console.log(type)
            this.currentFile = e.target.files[0]
            if (type === 'part') {
                this.handlePartFile()
            } else {
                this.handleAllFile()
            }
            e.target.value = '';
        },
        handlePartFile() {
            const partList = this.createChunks(this.currentFile);
            const lastDotIdx = this.currentFile.name.lastIndexOf('.');
            const extName = this.currentFile.name.slice(lastDotIdx);
            this.generateHash(partList).then(res => {
                const fileName = `${res}${extName}`;
                partList.forEach((part, index) => {
                    part.fileName = fileName;
                    part.chunkName = `${fileName}-${index}`;
                    part.loaded = 0;
                    part.percent = 0;
                })

                this.partList = partList
                this.fileName = fileName

                this.uploadParts(this.partList, this.fileName)
            })
        },
        /**
         * 上传所有文件
         */
        handleAllFile() {
            const formData = new FormData()
            formData.append('files', this.currentFile);
            formData.append('name', this.generateUUID());
            axios({
                method: 'POST',
                url: HOST + `/uploadAll`,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                data: formData,
            }).then(res => {
                if (res.data.success) {
                    this.$message('上传成功');
                }
            })
        },
        /**
         * 创建 chunk List
         * @param {*} file 文件
         * @param {*} size 切割的 chunk 大小 默认 10M
         */
        createChunks(file, size = DEFAULT_SIZE) {
            let current = 0;
            const partList = [];
            while (current < file.size) {
                const chunk = file.slice(current, current + size);
                partList.push({
                    chunk,
                    size: chunk.size,
                })
                current += size
            }
            return partList;
        },
        /**
         * 生成文件 hash
         * @param {[]} partList 
         */
        generateHash(partList) {
            return new Promise((resolve, reject) => {
                this.worker.postMessage({ partList });
                this.worker.onmessage = (event) => {
                    const { hash } = event.data;
                    if (hash) {
                        resolve(hash);
                    }
                }

                this.worker.onerror = error => {
                    reject(error);
                }
            })
        },
        async uploadParts(partList, fileName) {
            const res = await axios.get(HOST + `/verify/${fileName}`)
            const { data } = res
            if (data.code == 200) {
                // 不需要重新上传，实现秒传
                if (!data.data.needUpload) {
                    this.$message('秒传成功');
                    this.partList = this.partList.map((part) => ({
                        ...part,
                        loaded: DEFAULT_SIZE,
                        percent: 100,
                    }))
                    return
                }

                try {
                    const { uploadedList } = data.data
                    const requestList = this.createRequestList(partList, uploadedList, fileName);
                    const partsRes = await Promise.all(requestList);
                    console.log(partList, uploadedList, partsRes)
                    if (partsRes.every(item => item.data.code === 200)) {
                        const res = await axios.get(HOST + `/merge/${fileName}`)
                        const { data } = res
                        if (data.code === 200) {
                            this.$message.success('上传成功');
                            // this.reset()
                        } else {
                            this.$message.error('上传失败，请稍后重试~');
                        }
                    } else {
                        this.$message.error('上传失败，请稍后重试~');
                    }
                } catch (error) {
                    this.$message.error('上传失败或暂停');
                    console.error(error);
                }
            }
        },
        createRequestList(partList, uploadedList, fileName) {
            return partList.filter((part) => {
                const uploadedFile = uploadedList.find(item => item.fileName === part.chunkName);
                if (!uploadedFile) { // 此chunk还没上传过
                    part.loaded = 0;
                    part.percent = 0;
                    return true;
                }
                if (uploadedFile.size < part.chunk.size) { // 此chunk上传了一部分
                    part.loaded = uploadedFile.size;
                    part.percent = Number((part.loaded / part.chunk.size * 100).toFixed(2));
                    return true;
                }
                // 上传过了
                return false;
            }).map((part) => axios({
                method: 'POST',
                url: HOST + `/partUpload/${fileName}/${part.loaded}/${part.chunkName}`,
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
                signal: this.controller.signal,
                onUploadProgress: function (progressEvent) {
                    part.percent =  Number.parseFloat(progressEvent.loaded / progressEvent.total).toFixed(2) * 100;
                    console.log('part.chunkName==>', part.chunkName,  progressEvent.loaded / progressEvent.total)
                    this.partList = [...partList]
                    if (this.partList.length > 0 ) {
                        this.percent = this.partList.reduce((memo, curr) => memo + curr.percent, 0)
                    } else {
                        this.percent = 0
                    }
                },
                data: part.chunk.slice(part.loaded),
            }))
        },
        reset() {
            this.percent = 0
            this.partList = []
            this.fileName = ''
        },
        handlePause() {
            this.controller.abort()
        },
        generateUUID() {
            let d = new Date().getTime();
            let d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                let r = Math.random() * 16; //random number between 0 and 16
                if(d > 0){ //Use timestamp until depleted
                    r = (d + r)%16 | 0;
                    d = Math.floor(d/16);
                } else { //Use microseconds since page-load if supported
                    r = (d2 + r)%16 | 0;
                    d2 = Math.floor(d2/16);
                }
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        }
    }
}
</script>

<style lang="less">
.file {
    // display: none;
    visibility: hidden;
}
.break-point-upload {
    .upload-icon {
        cursor: pointer;
    }
}

.line {
    height: 1px;
    background-color: #e3e3e3;
    margin: 10px auto;
}
</style>