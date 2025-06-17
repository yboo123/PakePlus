document.addEventListener('alpine:init', () => {
    Alpine.data('wordGame', () => ({
        // 游戏状态
        wordsLoaded: false,
        wordList: [],
        currentWordIndex: 0,
        currentWord: '',
        wordLetters: [],
        score: 0,
        remainingWords: 0,
        syllableDatabase: null,
        correctBreaks: [],
        
        // 添加提示圈位置数组
        syllableHintPositions: [],
        
        // 用户交互
        syllableBreaks: [],
        feedback: '',
        feedbackType: '',
        autoCheckTimer: null,
        
        // 动画相关
        isSlicing: false,
        isJumping: false,
        showSplitEffect: false,
        
        // 语音相关
        isSpeaking: false,
        
        // 设置相关
        settingsOpen: false,
        
        // 图片资源
        monkeyImages: [],
        bananaImages: [],
        backgroundImages: [],
        
        // 当前选择的图片
        selectedMonkey: '',
        selectedBanana: '',
        selectedBackground: '',
        
        // 样式计算属性
        get monkeyStyle() {
            return {
                backgroundImage: `url('img/monkeys/${this.selectedMonkey}')`
            };
        },
        
        get bananaStyle() {
            return {
                backgroundImage: `url('img/bananas/${this.selectedBanana}')`
            };
        },
        
        get bananaTopStyle() {
            return {
                backgroundImage: `url('img/bananas/${this.selectedBanana}')`
            };
        },
        
        get bananaBottomStyle() {
            return {
                backgroundImage: `url('img/bananas/${this.selectedBanana}')`
            };
        },
        
        init() {
            this.loadSyllableDatabase();
            
            // 添加全局鼠标移动监听
            document.addEventListener('mousemove', this.handleMouseMove.bind(this));
            
            // 添加鼠标悬停检测
            this.setupHoverEffects();
            
            // 添加点击香蕉容器的事件
            setTimeout(() => {
                const bananaContainer = document.querySelector('.banana-container');
                if (bananaContainer) {
                    bananaContainer.addEventListener('click', this.handleContainerClick.bind(this));
                }
            }, 500);
            
            // 扫描并加载图片资源（包含加载设置和应用背景）
            this.scanImageFolders();
            
            // 添加点击外部区域关闭设置面板的功能
            document.addEventListener('click', (event) => {
                // 如果设置面板已打开
                if (this.settingsOpen) {
                    // 获取设置面板和设置按钮元素
                    const settingsPanel = document.querySelector('.settings-panel');
                    const settingsButton = document.querySelector('.settings-button');
                    
                    // 检查点击是否在设置面板外部且不是设置按钮
                    if (settingsPanel && settingsButton && 
                        !settingsPanel.contains(event.target) && 
                        !settingsButton.contains(event.target)) {
                        // 关闭设置面板
                        this.settingsOpen = false;
                    }
                }
            });
        },
        
        // 扫描图片文件夹并加载图片列表
        scanImageFolders() {
            // 先从本地存储加载设置
            let savedSettings = null;
            try {
                const savedData = localStorage.getItem('wordGameSettings');
                if (savedData) {
                    savedSettings = JSON.parse(savedData);
                }
            } catch (e) {
                console.error('读取本地存储设置出错:', e);
            }
            
            // 设置猴子图片
            this.getFilesInFolder('monkeys').then(images => {
                this.monkeyImages = images;
                if (images.length > 0) {
                    // 优先使用保存的设置，如果没有则使用第一张图片
                    this.selectedMonkey = (savedSettings && savedSettings.monkey && images.includes(savedSettings.monkey)) 
                        ? savedSettings.monkey 
                        : images[0];
                }
                console.log('猴子图片:', this.monkeyImages);
            });
            
            // 设置香蕉图片
            this.getFilesInFolder('bananas').then(images => {
                this.bananaImages = images;
                if (images.length > 0) {
                    // 优先使用保存的设置，如果没有则使用第一张图片
                    this.selectedBanana = (savedSettings && savedSettings.banana && images.includes(savedSettings.banana)) 
                        ? savedSettings.banana 
                        : images[0];
                }
                console.log('香蕉图片:', this.bananaImages);
            });
            
            // 设置背景图片
            this.getFilesInFolder('backgrounds').then(images => {
                this.backgroundImages = images;
                console.log('背景图片:', this.backgroundImages);
                
                // 如果有保存的背景设置且该背景图片存在，则应用它
                if (savedSettings && savedSettings.background && images.includes(savedSettings.background)) {
                    this.selectedBackground = savedSettings.background;
                    this.applyBackground(); // 立即应用背景
                } else if (images.length > 0) {
                    // 否则使用第一张图片作为默认背景
                    this.selectedBackground = images[0];
                    this.applyBackground(); // 立即应用背景
                }
            });
            
            console.log('开始加载图片资源...');
        },
        
        // 获取文件夹中的图片列表
        async getFilesInFolder(folderName) {
            // 首先获取默认图片列表
            const defaultImages = this.getDefaultImages(folderName);
            
            // 如果是在本地文件系统中运行，使用默认列表
            if (window.location.protocol === 'file:') {
                console.log(`本地文件系统环境，使用默认${folderName}图片列表`);
                return defaultImages;
            }
            
            try {
                // 创建一个新数组来存储确认存在的图片
                const confirmedImages = [];
                
                // 检查默认图片是否存在
                const defaultChecks = defaultImages.map(img => 
                    this.checkImageAsync(`img/${folderName}/${img}`)
                        .then(exists => {
                            if (exists) confirmedImages.push(img);
                        })
                );
                
                // 等待所有默认图片检查完成
                await Promise.all(defaultChecks);
                
                // 尝试扫描常见命名模式的图片
                const patterns = [
                    // 数字序列命名
                    ...[...Array(20)].map((_, i) => `${folderName.slice(0, -1)}${i+1}.png`),
                    ...[...Array(20)].map((_, i) => `${folderName.slice(0, -1)}${i+1}.jpg`),
                    // 单个字母命名
                    ...[...Array(26)].map((_, i) => `${folderName.slice(0, -1)}_${String.fromCharCode(97+i)}.png`),
                    // 描述性命名（背景特有）
                    ...(folderName === 'backgrounds' ? [
                        'forest.png', 'beach.png', 'classroom.png', 'space.png',
                        'forest.jpg', 'beach.jpg', 'classroom.jpg', 'space.jpg',
                        'mountain.png', 'desert.png', 'jungle.png', 'snow.png',
                        'mountain.jpg', 'desert.jpg', 'jungle.jpg', 'snow.jpg'
                    ] : [])
                ];
                
                // 检查所有可能的命名模式
                const patternChecks = patterns
                    .filter(name => !confirmedImages.includes(name)) // 避免重复检查
                    .map(name => 
                        this.checkImageAsync(`img/${folderName}/${name}`)
                            .then(exists => {
                                if (exists) confirmedImages.push(name);
                            })
                    );
                
                // 等待所有模式检查完成
                await Promise.all(patternChecks);
                
                // 如果没有找到任何图片，返回默认列表
                if (confirmedImages.length === 0) {
                    console.log(`未找到${folderName}图片，使用默认列表`);
                    return defaultImages;
                }
                
                console.log(`自动扫描到${confirmedImages.length}个${folderName}图片:`, confirmedImages);
                return confirmedImages;
            } catch (error) {
                console.error(`扫描${folderName}文件夹出错:`, error);
                return defaultImages;
            }
        },
        
        // 异步检查图片是否存在
        checkImageAsync(url) {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = url;
                
                // 设置超时，避免长时间等待
                setTimeout(() => resolve(false), 1000);
            });
        },
        
        // 检查图片是否存在 (同步方法，仅作为备用)
        imageExists(url) {
            try {
                const http = new XMLHttpRequest();
                http.open('HEAD', url, false);
                http.send();
                return http.status !== 404;
            } catch (error) {
                console.log(`检查图片${url}是否存在时出错:`, error);
                return false;
            }
        },
        
        // 判断文件是否为图片
        isImageFile(filename) {
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
            const lowerFilename = filename.toLowerCase();
            return imageExtensions.some(ext => lowerFilename.endsWith(ext));
        },
        
        // 获取默认图片列表
        getDefaultImages(folderName) {
            switch(folderName) {
                case 'monkeys':
                    return ['monkey.png', 'monkey2.png', 'monkey3.png'];
                case 'bananas':
                    return ['banana.png', 'banana2.png', 'banana3.png'];
                case 'backgrounds':
                    return ['bg1.png', 'bg2.png', 'bg3.png', 'bg4.png', 'bg5.png', 
                            'bg6.png', 'bg7.png', 'bg8.png', 'bg9.png', 'bg10.png'];
                default:
                    return [];
            }
        },
        
        // 切换设置面板
        toggleSettings() {
            this.settingsOpen = !this.settingsOpen;
        },
        
        // 选择猴子图片
        selectMonkey(image) {
            this.selectedMonkey = image;
            this.saveSettings();
        },
        
        // 选择香蕉图片
        selectBanana(image) {
            this.selectedBanana = image;
            this.saveSettings();
        },
        
        // 选择背景图片
        selectBackground(image) {
            this.selectedBackground = image;
            this.applyBackground();
            this.saveSettings();
        },
        
        // 应用背景图片
        applyBackground() {
            if (this.selectedBackground) {
                document.body.style.backgroundImage = `url('img/backgrounds/${this.selectedBackground}')`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
            } else {
                document.body.style.backgroundImage = '';
                document.body.style.backgroundColor = '#95c763'; // 默认背景色
            }
        },
        
        // 保存设置到本地存储
        saveSettings() {
            const settings = {
                monkey: this.selectedMonkey,
                banana: this.selectedBanana,
                background: this.selectedBackground
            };
            
            localStorage.setItem('wordGameSettings', JSON.stringify(settings));
        },
        
        // 添加朗读单词的方法
        speakCurrentWord() {
            if (!this.currentWord || this.isSpeaking) return;
            
            // 设置正在朗读状态
            this.isSpeaking = true;
            
            // 添加喇叭动画效果
            const speakerButton = document.querySelector('.speaker-button');
            if (speakerButton) {
                speakerButton.classList.add('active');
            }
            
            // 使用Web Speech API朗读单词
            const utterance = new SpeechSynthesisUtterance(this.currentWord);
            
            // 设置美式英语发音
            utterance.lang = 'en-US';
            utterance.rate = 0.9; // 稍微放慢语速以便清晰听到
            
            // 朗读结束后的回调
            utterance.onend = () => {
                this.isSpeaking = false;
                if (speakerButton) {
                    speakerButton.classList.remove('active');
                }
            };
            
            // 开始朗读
            window.speechSynthesis.speak(utterance);
            
            console.log('朗读单词:', this.currentWord);
        },
        
        loadSyllableDatabase() {
            // 从同级目录下的JSON文件加载音节数据库
            fetch('syllable-database.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('无法加载音节数据库文件');
                    }
                    return response.json();
                })
                .then(data => {
                    this.syllableDatabase = data;
                    console.log('音节数据库加载成功:', this.syllableDatabase);
                })
                .catch(error => {
                    console.error('加载音节数据库出错:', error);
                    // 加载失败时使用默认的简单词库
                    this.syllableDatabase = {
                        "token": {"syllables": "tok-en", "vowels": [2, 4]},
                        "listen": {"syllables": "li-sten", "vowels": [2,5]}
                    };
                });
        },
        
        loadCustomDatabase(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                this.feedback = '请上传JSON格式的文件';
                this.feedbackType = 'error';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (typeof data !== 'object' || data === null) {
                        throw new Error('数据格式不正确');
                    }
                    
                    this.syllableDatabase = data;
                    this.feedback = '自定义音节数据库加载成功！';
                    this.feedbackType = 'success';
                } catch (error) {
                    console.error('解析JSON数据出错:', error);
                    this.feedback = '解析JSON数据出错: ' + error.message;
                    this.feedbackType = 'error';
                }
            };
            
            reader.onerror = () => {
                this.feedback = '读取文件出错';
                this.feedbackType = 'error';
            };
            
            reader.readAsText(file);
        },
        
        startGame() {
            if (!this.syllableDatabase) {
                this.feedback = '音节数据库正在加载中，请稍后再试';
                this.feedbackType = 'info';
                
                // 等待数据库加载完成后自动开始游戏
                const checkDatabase = setInterval(() => {
                    if (this.syllableDatabase) {
                        clearInterval(checkDatabase);
                        this.startGameProcess();
                    }
                }, 500);
                
                return;
            }
            
            this.startGameProcess();
        },
        
        // 将游戏启动逻辑分离为独立方法
        startGameProcess() {
            this.wordList = Object.keys(this.syllableDatabase);
            this.shuffleWords();
            
            this.wordsLoaded = true;
            this.remainingWords = this.wordList.length;
            this.loadNextWord();
        },
        
        shuffleWords() {
            for (let i = this.wordList.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.wordList[i], this.wordList[j]] = [this.wordList[j], this.wordList[i]];
            }
        },
        
        loadNextWord() {
            if (this.currentWordIndex >= this.wordList.length) {
                this.currentWord = '游戏结束！';
                this.wordLetters = [];
                this.feedback = `你的最终得分是: ${this.score}`;
                this.feedbackType = 'success';
                return;
            }
            
            this.currentWord = this.wordList[this.currentWordIndex];
            this.wordLetters = this.currentWord.split('');
            this.syllableBreaks = [];
            this.isSlicing = false;
            this.isJumping = false;
            this.showSplitEffect = false;
            
            // 隐藏裂开的香蕉效果
            const bananaContainer = document.querySelector('.banana-container');
            const bananaTop = document.querySelector('.banana-top');
            const bananaBottom = document.querySelector('.banana-bottom');
            
            // 重置香蕉切割状态
            bananaContainer.classList.remove('split-active');
            
            // 重置切分位置为默认的50%
            bananaTop.style.clipPath = 'polygon(0 0, 50% 0, 50% 100%, 0 100%)';
            bananaBottom.style.clipPath = 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)';
            
            // 清除所有之前的切分效果元素
            const splitEffects = document.querySelectorAll('.split-effect');
            splitEffects.forEach(effect => {
                effect.remove();
            });
            
            // 清空切分效果容器
            const effectsContainer = document.getElementById('split-effects-container');
            if (effectsContainer) {
                effectsContainer.innerHTML = '';
            }
            
            // 重置slash-effect位置和状态
            const slashElement = document.querySelector('.slash-effect');
            if (slashElement) {
                slashElement.style.left = '50%';
                slashElement.style.top = '0';
                slashElement.style.height = '10px';
                slashElement.classList.remove('active'); // 确保移除active类
            }
            
            // 重置猴子所有动画状态
            const monkeyElement = document.querySelector('.monkey');
            if (monkeyElement) {
                monkeyElement.classList.remove('slicing', 'forward-spin', 'backward-spin');
                monkeyElement.classList.add('behind');
            }
            
            // 在第一个单词加载时显示提示
            if (this.currentWordIndex === 0) {
                this.feedback = '点击字母之间的竖线来切分单词！';
                this.feedbackType = 'info';
                
                // 5秒后清除提示
                setTimeout(() => {
                    if (this.feedback === '点击字母之间的竖线来切分单词！') {
                        this.feedback = '';
                    }
                }, 5000);
            } else {
                this.feedback = '';
            }
            
            this.calculateCorrectBreaks();
            this.generateHintPositions();
            
            // 重新设置悬停效果
            this.setupHoverEffects();
            
            // 新增：加载单词后自动朗读
            setTimeout(() => {
                this.speakCurrentWord();
            }, 500);
        },
        
        calculateCorrectBreaks() {
            const word = this.currentWord.toLowerCase();
            this.correctBreaks = [];
            
            if (this.syllableDatabase && this.syllableDatabase[word]) {
                const wordData = this.syllableDatabase[word];
                
                if (wordData.syllables) {
                    const syllables = wordData.syllables.split('-');
                    let position = 0;
                    
                    for (let i = 0; i < syllables.length - 1; i++) {
                        position += syllables[i].length;
                        this.correctBreaks.push(position - 1);
                    }
                }
            } else {
                let vowelFound = false;
                for (let i = 0; i < word.length - 1; i++) {
                    if (this.isVowel(word[i])) {
                        vowelFound = true;
                    } else if (vowelFound && !this.isVowel(word[i]) && !this.isVowel(word[i+1])) {
                        this.correctBreaks.push(i);
                        vowelFound = false;
                    }
                }
            }
        },
        
        isVowel(letter) {
            return ['a', 'e', 'i', 'o', 'u'].includes(letter.toLowerCase());
        },
        
        toggleSyllableBreak(index) {
            // 检查是否是正确的切分位置
            const isCorrectBreak = this.correctBreaks.includes(index);
            
            const position = this.syllableBreaks.indexOf(index);
            if (position === -1) {
                // 只有正确的位置才能添加切分
                if (isCorrectBreak) {
                    this.syllableBreaks.push(index);
                    this.playSliceAnimation(index);
                    
                    // 立即反馈正确
                    this.feedback = '音节切分正确！';
                    this.feedbackType = 'success';
                    
                    // 立即检查是否所有切分点都已添加
                    this.checkSyllables();
                } else {
                    // 错误位置给出提示并添加抖动效果
                    const breakElement = document.querySelectorAll('.syllable-break')[index];
                    if (breakElement) {
                        breakElement.classList.add('error-shake');
                        
                        // 播放错误音效
                        try {
                            const errorSound = new Audio('img/error.mp3');
                            errorSound.play().catch(e => console.log('无法播放错误音效:', e));
                        } catch (e) {
                            console.log('不支持音频播放');
                        }
                        
                        setTimeout(() => {
                            breakElement.classList.remove('error-shake');
                        }, 500);
                    }
                    
                    this.feedback = '这里不是正确的音节切分点，请再试试！';
                    this.feedbackType = 'error';
                }
            } else {
                // 允许移除已有的切分点
                this.syllableBreaks.splice(position, 1);
                
                // 移除视觉效果
                const breakElement = document.querySelectorAll('.syllable-break')[index];
                if (breakElement) {
                    breakElement.classList.remove('active');
                }
                
                // 移除切分点后立即重新检查
                this.checkSyllables();
            }
            
            // 不再需要延迟检查，因为我们已经在添加和移除切分点时立即检查了
        },
        
        playSliceAnimation(index) {
            // 播放猴子切香蕉的动画
            const monkeyElement = document.querySelector('.monkey');
            const slashElement = document.querySelector('.slash-effect');
            const bananaContainer = document.querySelector('.banana-container');
            
            // 计算切割位置，与点击位置对齐
            const letterContainer = document.querySelector('.letter-container');
            const letterGroups = letterContainer.querySelectorAll('.letter-group');
            const targetGroup = letterGroups[index];
            
            if (targetGroup) {
                // 找到切分点元素
                const syllableBreak = targetGroup.querySelector('.syllable-break');
                if (syllableBreak) {
                    // 获取syllable-break位置的中心点相对于香蕉容器的位置
                    const syllableRect = syllableBreak.getBoundingClientRect();
                    const containerRect = bananaContainer.getBoundingClientRect();
                    
                    // 计算相对于香蕉容器的精确位置
                    const centerX = syllableRect.left + (syllableRect.width / 2) - containerRect.left;
                    const centerY = syllableRect.top + (syllableRect.height / 2) - containerRect.top;
                    
                    // 设置光柱位置，确保精确对准切分点
                    slashElement.style.left = `${centerX}px`;
                    slashElement.style.top = `${centerY}px`;
                    slashElement.style.height = '10px'; // 初始高度
                    
                    // 确保切分线与字母位置对齐
                    console.log(`切分位置: ${centerX}px, ${centerY}px`); // 添加调试信息
                    
                    // 创建新的切分效果元素
                    this.createSplitEffect(centerX, centerY);
                }
            }
            
            // 移除之前的动画类
            monkeyElement.classList.remove('behind', 'slicing', 'backward-spin');
            
            // 添加正向旋转动画
            monkeyElement.classList.add('forward-spin');
            
            // 播放猴子冲锋音效
            try {
                const monkeySound = new Audio('img/monkey.mp3');
                monkeySound.play().catch(e => console.log('无法播放猴子音效:', e));
            } catch (e) {
                console.log('不支持音频播放');
            }
            
            // 添加斩击效果
            slashElement.classList.add('active');
            
            // 创建粒子效果
            this.createParticles(index);
            
            // 显示香蕉裂开的效果
            this.showSplitEffect = true;
            
            // 添加声音效果（可选）
            try {
                const sliceSound = new Audio('img/slice.mp3');
                sliceSound.play().catch(e => console.log('无法播放声音:', e));
            } catch (e) {
                console.log('不支持音频播放');
            }
            
            // 正向旋转动画结束后立即开始反向旋转动画，无需停顿
            setTimeout(() => {
                monkeyElement.classList.remove('forward-spin');
                monkeyElement.classList.add('backward-spin');
                
                // 动画结束后恢复初始状态
                setTimeout(() => {
                    monkeyElement.classList.remove('backward-spin');
                    monkeyElement.classList.add('behind');
                }, 2000); // 反向旋转动画持续1.5秒
            }, 2000); // 正向旋转动画持续1.5秒后立即开始反向旋转
        },
        
        // 新增方法：创建切分效果
        createSplitEffect(centerX, centerY) {
            // 使用专用容器存放切分效果
            const effectsContainer = document.getElementById('split-effects-container') || document.querySelector('.banana-container');
            
            // 找到字母容器获取字母高度
            const letterElement = document.querySelector('.letter');
            const letterHeight = letterElement ? letterElement.offsetHeight : 32; // 默认高度为32px
            
            // 创建新的切分效果元素
            const splitEffect = document.createElement('div');
            splitEffect.className = 'split-effect persistent'; // 添加persistent类
            splitEffect.style.position = 'absolute';
            
            // 使用像素值而不是百分比，以确保精确定位
            splitEffect.style.left = `${centerX}px`;
            
            // 获取字母容器的位置
            const letterContainer = document.querySelector('.letter-container');
            if (letterContainer) {
                const letterContainerRect = letterContainer.getBoundingClientRect();
                const containerRect = effectsContainer.getBoundingClientRect();
                const letterContainerTop = letterContainerRect.top - containerRect.top;
                const letterContainerHeight = letterContainerRect.height;
                
                // 设置切分效果在字母中间，高度为字母高度的两倍
                splitEffect.style.top = `${centerY}px`;
                splitEffect.style.height = `${letterHeight * 2}px`;
                splitEffect.style.transform = 'translate(-50%, -50%)';
            } else {
                // 如果找不到字母容器，使用默认值
                splitEffect.style.top = '50%';
                splitEffect.style.height = '120px'; // 从16vw改为固定像素值
                splitEffect.style.transform = 'translate(-50%, -50%)';
            }
            
            splitEffect.style.width = '2px';
            splitEffect.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
            splitEffect.style.boxShadow = '0 0 8px 2px rgba(255, 255, 255, 0.5)';
            splitEffect.style.zIndex = '15';
            splitEffect.style.opacity = '1'; // 确保它是可见的
            
            // 添加到容器中
            effectsContainer.appendChild(splitEffect);
            
            // 添加淡入动画
            splitEffect.animate([
                { opacity: 0 },
                { opacity: 1 }
            ], {
                duration: 300,
                fill: 'forwards'
            });
        },
        
        createParticles(index) {
            const container = document.getElementById('particles');
            container.innerHTML = '';
            
            // 计算粒子发射位置
            const letterContainer = document.querySelector('.letter-container');
            const letterGroups = letterContainer.querySelectorAll('.letter-group');
            const targetGroup = letterGroups[index];
            
            if (!targetGroup) return;
            
            // 找到切分点元素以获取更精确的位置
            const syllableBreak = targetGroup.querySelector('.syllable-break');
            if (!syllableBreak) return;
            
            const syllableRect = syllableBreak.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // 使用切分点的中心点位置
            const centerX = syllableRect.left + (syllableRect.width / 2) - containerRect.left;
            const centerY = syllableRect.top + (syllableRect.height / 2) - containerRect.top;
            
            // 创建多个粒子 - 增加粒子数量使效果更夸张
            for (let i = 0; i < 40; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                
                // 随机位置但主要朝左右两侧散开
                const x = centerX;
                const y = centerY + (Math.random() - 0.5) * 100; // 在竖线上随机分布
                
                // 主要是水平方向的移动，配合竖向切割
                const isLeft = Math.random() > 0.5;
                const tx = isLeft ? -100 - Math.random() * 150 : 100 + Math.random() * 150;
                const ty = (Math.random() - 0.5) * 100; // 小幅度垂直偏移
                
                // 随机大小和银色系颜色
                const size = 5 + Math.random() * 8;
                const brightness = 80 + Math.random() * 20; // 银色系
                
                particle.style.width = size + 'px';
                particle.style.height = size + 'px';
                particle.style.backgroundColor = `rgb(${brightness}%, ${brightness}%, ${brightness}%)`;
                particle.style.left = x + 'px';
                particle.style.top = y + 'px';
                particle.style.setProperty('--tx', tx + 'px');
                particle.style.setProperty('--ty', ty + 'px');
                
                container.appendChild(particle);
                
                // 延迟激活粒子以创建更好的效果
                setTimeout(() => {
                    particle.classList.add('active');
                }, Math.random() * 300);
            }
        },
        
        checkSyllables() {
            // 检查用户添加的切分点是否都是正确的
            const allBreaksCorrect = this.syllableBreaks.every(index => this.correctBreaks.includes(index));
            
            // 检查是否所有正确的切分点都已添加
            const allCorrectBreaksAdded = this.correctBreaks.every(index => this.syllableBreaks.includes(index));
            
            // 输出调试信息
            console.log('用户添加的切分点:', this.syllableBreaks);
            console.log('正确的切分点:', this.correctBreaks);
            console.log('所有添加的都正确?', allBreaksCorrect);
            console.log('所有正确的都添加了?', allCorrectBreaksAdded);
            
            if (allBreaksCorrect && allCorrectBreaksAdded) {
                this.score += 20;
                this.feedback = '正确！';
                this.feedbackType = 'success';
                
                // 播放正确的切分动画
                this.playSuccessAnimation();
                
                // 新增：单词切分完成后再次朗读单词
                setTimeout(() => {
                    this.speakCurrentWord();
                }, 1000);
                
                // 调整等待时间，确保猴子动画完成后再加载下一个单词
                // 猴子动画总时间 = 正向旋转(1.5秒) + 反向旋转(1.5秒) = 3秒
                setTimeout(() => {
                    this.currentWordIndex++;
                    this.remainingWords--;
                    this.loadNextWord();
                }, 3500); // 给予3.5秒时间让猴子完成动画
            } else if (allBreaksCorrect && this.syllableBreaks.length > 0) {
                // 如果已添加的切分点都是正确的，但还没有全部添加完
                this.feedback = '正确！还有更多切分点...';
                this.feedbackType = 'info';
            } else {
                this.feedback = '继续尝试...';
                this.feedbackType = 'error';
            }
        },
        
        playSuccessAnimation() {
            // 在正确切分后播放特殊动画
            this.showSplitEffect = true;
            
            // 高亮所有切分效果
            const splitEffects = document.querySelectorAll('.split-effect');
            splitEffects.forEach(effect => {
                // 增强切分线的亮度和发光效果
                effect.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                effect.style.boxShadow = '0 0 15px 5px rgba(255, 255, 255, 0.8), 0 0 30px 10px rgba(76, 175, 80, 0.6)';
                
                // 添加脉冲动画
                effect.animate([
                    { boxShadow: '0 0 15px 5px rgba(255, 255, 255, 0.8), 0 0 30px 10px rgba(76, 175, 80, 0.6)' },
                    { boxShadow: '0 0 25px 10px rgba(255, 255, 255, 0.9), 0 0 40px 15px rgba(76, 175, 80, 0.8)' },
                    { boxShadow: '0 0 15px 5px rgba(255, 255, 255, 0.8), 0 0 30px 10px rgba(76, 175, 80, 0.6)' }
                ], {
                    duration: 1000,
                    iterations: 2
                });
            });
            
            // 播放成功音效
            try {
                const successSound = new Audio('img/success.mp3');
                successSound.play().catch(e => console.log('无法播放成功音效:', e));
            } catch (e) {
                console.log('不支持音频播放');
            }
            
            // 让字母放大再缩小
            const letterElements = document.querySelectorAll('.letter');
            letterElements.forEach(el => {
                el.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    el.style.transform = 'scale(1)';
                }, 300);
            });
        },
        
        // 添加一个新方法来设置鼠标悬停效果
        setupHoverEffects() {
            // 在DOM更新后添加事件监听
            setTimeout(() => {
                const syllableBreaks = document.querySelectorAll('.syllable-break');
                syllableBreaks.forEach((breakEl, index) => {
                    // 鼠标进入时高亮
                    breakEl.addEventListener('mouseenter', () => {
                        if (!this.syllableBreaks.includes(index)) {
                            breakEl.classList.add('hover');
                        }
                    });
                    
                    // 鼠标离开时移除高亮
                    breakEl.addEventListener('mouseleave', () => {
                        breakEl.classList.remove('hover');
                    });
                });
            }, 500);
        },
        
        // 添加鼠标悬停处理方法
        hoverSyllableBreak(index, isHovering) {
            const breakElements = document.querySelectorAll('.syllable-break');
            if (breakElements[index]) {
                if (isHovering) {
                    breakElements[index].classList.add('hover');
                } else {
                    breakElements[index].classList.remove('hover');
                }
            }
        },
        
        // 新增方法：生成提示圈位置
        generateHintPositions() {
            this.syllableHintPositions = [];
            
            // 根据当前单词长度和正确切分点生成提示圈
            // 为每个正确的切分点生成2-3个提示圈
            this.correctBreaks.forEach(breakIndex => {
                // 在香蕉上部区域添加1-2个提示圈
                for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
                    this.syllableHintPositions.push({
                        x: 30 + Math.random() * 40, // 30%-70%横向范围内
                        y: 10 + Math.random() * 30, // 10%-40%纵向范围内
                        breakIndex: breakIndex // 关联的切分点索引
                    });
                }
                
                // 在香蕉下部区域添加1-2个提示圈
                for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
                    this.syllableHintPositions.push({
                        x: 30 + Math.random() * 40, // 30%-70%横向范围内
                        y: 70 + Math.random() * 20, // 70%-90%纵向范围内
                        breakIndex: breakIndex // 关联的切分点索引
                    });
                }
            });
        },
        
        // 新增方法：处理鼠标在提示圈上的悬停
        highlightNearestBreak(position) {
            if (position && position.breakIndex !== undefined) {
                const breakElements = document.querySelectorAll('.syllable-break');
                const targetBreak = breakElements[position.breakIndex];
                
                if (targetBreak) {
                    // 移除所有其他高亮
                    breakElements.forEach(el => el.classList.remove('hover'));
                    
                    // 高亮当前切分点
                    targetBreak.classList.add('hover');
                }
            }
        },
        
        // 新增方法：移除所有高亮
        unhighlightAllBreaks() {
            const breakElements = document.querySelectorAll('.syllable-break');
            breakElements.forEach(el => el.classList.remove('hover'));
        },
        
        // 新增方法：点击提示圈时触发对应切分点的点击
        clickNearestBreak(position) {
            if (position && position.breakIndex !== undefined) {
                this.toggleSyllableBreak(position.breakIndex);
            }
        },
        
        // 新增方法：处理鼠标移动
        handleMouseMove(event) {
            // 获取香蕉容器的位置信息
            const bananaContainer = document.querySelector('.banana-container');
            if (!bananaContainer) return;
            
            const containerRect = bananaContainer.getBoundingClientRect();
            
            // 判断鼠标是否在香蕉容器内
            if (event.clientX >= containerRect.left && 
                event.clientX <= containerRect.right && 
                event.clientY >= containerRect.top && 
                event.clientY <= containerRect.bottom) {
                
                // 获取所有分割线元素
                const syllableBreaks = document.querySelectorAll('.syllable-break');
                if (syllableBreaks.length === 0) return;
                
                // 计算鼠标在容器中的相对X坐标
                const mouseX = event.clientX;
                
                // 找出最近的分割线
                let closestBreak = null;
                let closestDistance = Number.MAX_VALUE;
                
                syllableBreaks.forEach((breakEl, index) => {
                    const breakRect = breakEl.getBoundingClientRect();
                    const breakCenterX = breakRect.left + breakRect.width / 2;
                    const distance = Math.abs(mouseX - breakCenterX);
                    
                    // 如果这条分割线是最近的，记录它
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestBreak = {element: breakEl, index: index};
                    }
                });
                
                // 如果找到了最近的分割线且距离在一定范围内（例如50px），高亮它
                if (closestBreak && closestDistance < 50) {
                    // 移除所有分割线的高亮效果和显示状态
                    syllableBreaks.forEach(el => {
                        el.classList.remove('hover');
                    });
                    
                    // 高亮最近的分割线（如果它没有被激活）
                    if (!this.syllableBreaks.includes(closestBreak.index)) {
                        closestBreak.element.classList.add('hover');
                    }
                } else {
                    // 如果没有足够近的分割线，移除所有高亮
                    syllableBreaks.forEach(el => el.classList.remove('hover'));
                }
            } else {
                // 鼠标在容器外，移除所有高亮
                const syllableBreaks = document.querySelectorAll('.syllable-break');
                syllableBreaks.forEach(el => el.classList.remove('hover'));
            }
        },
        
        // 添加新方法：处理香蕉容器点击事件
        handleContainerClick(event) {
            // 获取当前高亮的分割线
            const highlightedBreak = document.querySelector('.syllable-break.hover');
            if (highlightedBreak) {
                // 找出对应的索引
                const allBreaks = document.querySelectorAll('.syllable-break');
                let index = -1;
                for (let i = 0; i < allBreaks.length; i++) {
                    if (allBreaks[i] === highlightedBreak) {
                        index = i;
                        break;
                    }
                }
                
                // 如果找到了索引，触发切割
                if (index !== -1) {
                    // 阻止事件冒泡，避免重复触发
                    event.stopPropagation();
                    // 执行切割操作
                    this.toggleSyllableBreak(index);
                }
            }
        }
    }));
}); 