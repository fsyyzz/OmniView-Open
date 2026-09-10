# KaTeX 数学与科学公式示例集 (Math & Scientific Formulas)

本文档全面展示 OmniView 对 **KaTeX 数学公式渲染引擎** 的支持能力。涵盖行内公式、块级多行方程组、矩阵代数、分段函数、微积分、物理学四大经典方程组、现代深度学习（Transformer 注意力机制）与算法复杂度分析。

---

## 1. 基础数学与代数公式

### 1.1 行内公式 (Inline Math `$ ... $`)
- 勾股定理：在直角三角形中，$a^2 + b^2 = c^2$。
- 根号与分式：二次方程 $ax^2 + bx + c = 0$ 的求根公式为 $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$。
- 极限与无穷：$\lim_{x \to 0} \frac{\sin x}{x} = 1$，以及 $\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e$。
- 常见集合与数域：$x \in \mathbb{R}$，$\mathbb{N} \subset \mathbb{Z} \subset \mathbb{Q} \subset \mathbb{R} \subset \mathbb{C}$。
- 货币与符号防误触测试：原价为 $99.99，会员优惠后仅需 $49.50（纯文本价格不被识别为公式）。

### 1.2 块级公式 (Block Math `$$ ... $$`)

**欧拉恒等式与泰勒级数展开：**
$$e^{ix} = \cos x + i\sin x \implies e^{i\pi} + 1 = 0$$

$$f(x) = f(a) + f'(a)(x - a) + \frac{f''(a)}{2!}(x - a)^2 + \cdots + \frac{f^{(n)}(a)}{n!}(x - a)^n + R_n(x)$$

---

## 2. 线性代数与矩阵运算

### 2.1 矩阵与行列式 (Matrices & Determinants)

$$A = \begin{pmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{pmatrix}, \quad
\det(A) = \begin{vmatrix}
\lambda - a_{11} & -a_{12} \\
-a_{21} & \lambda - a_{22}
\end{vmatrix}$$

### 2.2 特征值与奇异值分解 (Eigendecomposition & SVD)

$$A v = \lambda v \iff (A - \lambda I)v = 0$$

$$A = U \Sigma V^T = \sum_{i=1}^{r} \sigma_i u_i v_i^T$$

---

## 3. 微积分与多元分析

### 3.1 定积分与高斯积分
$$\int_{-\infty}^{+\infty} e^{-x^2} dx = \sqrt{\pi}$$

$$\Gamma(z) = \int_0^\infty t^{z-1} e^{-t} dt, \quad \Gamma(n) = (n-1)!$$

### 3.2 梯度、散度与旋度 (Multivariable Calculus)

$$\nabla f = \left( \frac{\partial f}{\partial x_1}, \frac{\partial f}{\partial x_2}, \dots, \frac{\partial f}{\partial x_n} \right)$$

$$\text{div}(\mathbf{F}) = \nabla \cdot \mathbf{F} = \frac{\partial F_x}{\partial x} + \frac{\partial F_y}{\partial y} + \frac{\partial F_z}{\partial z}$$

---

## 4. 物理学经典方程组

### 4.1 麦克斯韦方程组 (Maxwell's Equations in Differential Form)

$$\begin{aligned}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\varepsilon_0} && \text{(高斯定律)} \\
\nabla \cdot \mathbf{B} &= 0 && \text{(高斯磁定律)} \\
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} && \text{(法拉第电磁感应定律)} \\
\nabla \times \mathbf{B} &= \mu_0 \left(\mathbf{J} + \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}\right) && \text{(安培-麦克斯韦定律)}
\end{aligned}$$

### 4.2 量子力学薛定谔方程 (Schrödinger Equation)

$$i\hbar \frac{\partial}{\partial t}\Psi(\mathbf{r}, t) = \hat{H}\Psi(\mathbf{r}, t) = \left[ -\frac{\hbar^2}{2m}\nabla^2 + V(\mathbf{r}, t) \right] \Psi(\mathbf{r}, t)$$

### 4.3 广义相对论引力场方程 (Einstein Field Equations)

$$G_{\mu\nu} + \Lambda g_{\mu\nu} = \frac{8\pi G}{c^4} T_{\mu\nu}$$

---

## 5. 现代人工智能与深度学习数学模型

### 5.1 Transformer 缩放点积注意力 (Scaled Dot-Product Attention)

$$\text{Attention}(Q, K, V) = \text{softmax}\left( \frac{QK^T}{\sqrt{d_k}} \right) V$$

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \dots, \text{head}_h)W^O$$
$$\text{where} \quad \text{head}_i = \text{Attention}(QW_i^Q, KW_i^K, VW_i^V)$$

### 5.2 交叉熵与损失函数 (Loss Functions & Optimization)

$$\mathcal{L}_{\text{CE}}(y, \hat{y}) = -\sum_{c=1}^C y_c \log(\hat{y}_c) = -\log\left( \frac{e^{z_y}}{\sum_{j=1}^C e^{z_j}} \right)$$

$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t \quad \text{(Adam 优化器)}$$

---

## 6. 分段函数与条件定义 (Piecewise Functions)

$$f(x) = \begin{cases}
0, & \text{if } x < 0 \\
\frac{1}{2}, & \text{if } x = 0 \\
1, & \text{if } x > 0
\end{cases} \qquad
\text{ReLU}(x) = \max(0, x) = \begin{cases}
x, & x \ge 0 \\
0, & x < 0
\end{cases}$$

---

## 7. 代码块公式支持 (```math / ```katex / ```latex)

### 7.1 math 语法块
```math
\oint_{\partial \Sigma} \mathbf{A} \cdot d\mathbf{r} = \iint_{\Sigma} (\nabla \times \mathbf{A}) \cdot d\mathbf{S}
```

### 7.2 katex 语法块
```katex
\mathcal{F}\{f(t)\} = F(\omega) = \int_{-\infty}^{\infty} f(t) e^{-i\omega t} dt
```

### 7.3 latex 语法块
```latex
\left( \sum_{k=1}^n a_k b_k \right)^2 \le \left( \sum_{k=1}^n a_k^2 \right) \left( \sum_{k=1}^n b_k^2 \right) \quad \text{(柯西-施瓦茨不等式)}
```
