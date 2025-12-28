pipeline {
  // Run on any agent; prefer Docker CLI if available, otherwise run natively
  agent any

  options {
    timeout(time: 20, unit: 'MINUTES')
  }

  environment {
    // Customize if you need a different base URL baked at build time
    VITE_API_BASE = '/api'
    // Faster npm mirror for China
    NPM_REGISTRY = 'https://registry.npmmirror.com'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      steps {
        sh '''
          if docker info >/dev/null 2>&1; then
            docker run --rm \
              -u $(id -u):$(id -g) \
              -v "$PWD":/app -w /app \
              -e NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
              node:20-alpine \
              sh -c "npm config set registry $NPM_CONFIG_REGISTRY && npm ci"
          else
            echo "Docker unavailable or permission denied; running npm install natively" >&2
            if ! command -v npm >/dev/null 2>&1; then
              echo "npm is not installed on this agent; please install Node.js 20 or enable Docker" >&2
              exit 1
            fi
            npm config set registry ${NPM_REGISTRY}
            npm ci
          fi
        '''
      }
    }

    stage('Test') {
      steps {
        // Mirror GitHub Actions: run tests but do not fail the pipeline on test failure
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh '''
            if docker info >/dev/null 2>&1; then
              docker run --rm \
                -u $(id -u):$(id -g) \
                -v "$PWD":/app -w /app \
                -e NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
                node:20-alpine \
                sh -c "npm config set registry $NPM_CONFIG_REGISTRY && npm test -- --coverage=false"
            else
              echo "Docker unavailable or permission denied; running tests natively" >&2
              if ! command -v npm >/dev/null 2>&1; then
                echo "npm is not installed on this agent; please install Node.js 20 or enable Docker" >&2
                exit 1
              fi
              npm config set registry ${NPM_REGISTRY}
              npm test -- --coverage=false
            fi
          '''
        }
      }
    }

    stage('Build') {
      steps {
        sh '''
          if docker info >/dev/null 2>&1; then
            docker run --rm \
              -u $(id -u):$(id -g) \
              -v "$PWD":/app -w /app \
              -e NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
              -e VITE_API_BASE=${VITE_API_BASE} \
              node:20-alpine \
              sh -c "npm config set registry $NPM_CONFIG_REGISTRY && npm run build"
          else
            echo "Docker unavailable or permission denied; running build natively" >&2
            if ! command -v npm >/dev/null 2>&1; then
              echo "npm is not installed on this agent; please install Node.js 20 or enable Docker" >&2
              exit 1
            fi
            npm config set registry ${NPM_REGISTRY}
            npm run build
          fi
        '''
      }
    }

    stage('Archive Artifacts') {
      steps {
        archiveArtifacts artifacts: 'dist/**', fingerprint: true

        sh '''
          echo "Commit: ${GIT_COMMIT}" > build_info.txt
          echo "Branch: ${GIT_BRANCH}" >> build_info.txt
          echo "Date: $(date -u)" >> build_info.txt
        '''
        archiveArtifacts artifacts: 'build_info.txt', fingerprint: true
      }
    }

    // stage('Deploy to VolcEngine') {
    //   when {
    //     branch 'main'
    //   }
    //   steps {
    //     // Requires Jenkins credential ID 'volc_ssh_key' (SSH username/private key)
    //     // and env vars VOLC_USER/VOLC_HOST
    //     withCredentials([sshUserPrivateKey(credentialsId: 'volc_ssh_key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
    //       sh '''
    //         chmod 600 "$SSH_KEY"
    //         ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ${SSH_USER:-${VOLC_USER}}@${VOLC_HOST} <<'EOF'
    //           cd /home/shuyolin/quantFinance-dashboard
    //           git pull
    //           npm ci
    //           npm run build
    //           sudo systemctl restart dashboard
    //         EOF
    //       '''
    //     }
    //   }
    // }
  }

  post {
    cleanup {
      // Clean npm cache and workspace to keep agent lean
      sh 'npm cache clean --force || true'
    }
  }
}