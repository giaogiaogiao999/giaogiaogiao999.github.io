(function(){
  'use strict';
  const isZh=location.pathname.startsWith('/zh/');
  const copy=isZh?{
    notFound:'未找到该产品',back:'返回产品中心',description:'这是一款由管理员新增的铝型材产品，可提交询价获取详细规格与报价。',model:'型号',material:'材质',finish:'表面处理',dimensions:'尺寸',quantity:'数量',add:'加入询价',added:'已加入询价清单。',inactive:'该产品暂未上架。'
  }:{
    notFound:'Product not found',back:'Back to products',description:'This aluminum profile was added by the administrator. Submit an inquiry for detailed specifications and pricing.',model:'Model',material:'Material',finish:'Surface finish',dimensions:'Dimensions',quantity:'Quantity',add:'Add to inquiry',added:'Added to your inquiry list.',inactive:'This product is currently unavailable.'
  };
  const params=new URLSearchParams(location.search);
  const id=params.get('id')||'';
  const state=document.querySelector('[data-product-state]');
  const productView=document.querySelector('[data-product-view]');
  const safeImage=(value)=>{
    const text=String(value||'');
    return /^(?:data:image\/(?:jpeg|png|webp|gif);base64,|\/)/i.test(text)?text:'/wp-content/uploads/2026/10/logo.png';
  };
  const setText=(name,value)=>document.querySelectorAll(`[data-product-${name}]`).forEach((node)=>{node.textContent=String(value||'');});
  async function start(){
    try{
      const products=window.LumosyCloud?.enabled?await window.LumosyCloud.getProducts():JSON.parse(localStorage.getItem('lumosy_products_v1')||'[]');
      const product=products.find((item)=>String(item.id)===id);
      if(!product||product.status==='inactive')throw new Error(product?copy.inactive:copy.notFound);
      const title=isZh&&product.titleZh?product.titleZh:product.title;
      const category=isZh&&product.categoryZh?product.categoryZh:product.category;
      document.title=`${title} | LUMOSY Aluminum`;
      const languagePath=isZh?'/product/custom/':'/zh/product/custom/';
      const languageLink=document.querySelector(`a[href="${languagePath}"]`);
      if(languageLink)languageLink.href=`${languagePath}?id=${encodeURIComponent(product.id)}`;
      setText('title',title);setText('category',category);setText('description',product.description||copy.description);
      const image=document.querySelector('[data-product-image]');image.src=safeImage(product.image);image.alt=title;
      const specs=[['model',copy.model,product.model],['material',copy.material,product.material],['finish',copy.finish,product.finish],['dimensions',copy.dimensions,product.dimensions]];
      const list=document.querySelector('[data-product-specs]');
      list.innerHTML=specs.filter(([, ,value])=>value).map(([key,label,value])=>`<div data-spec="${key}"><dt></dt><dd></dd></div>`).join('');
      specs.filter(([, ,value])=>value).forEach(([key,label,value])=>{const row=list.querySelector(`[data-spec="${key}"]`);row.querySelector('dt').textContent=label;row.querySelector('dd').textContent=value;});
      document.querySelector('[data-product-quantity-label]').textContent=copy.quantity;
      const button=document.querySelector('[data-add-product]');button.textContent=copy.add;
      button.addEventListener('click',()=>{
        const qty=Math.max(1,Number(document.querySelector('[data-product-quantity]').value)||1);
        const key='lumosy_static_quote_v1';let items=[];try{items=JSON.parse(localStorage.getItem(key)||'[]');}catch{}
        const existing=items.find((item)=>String(item.id)===String(product.id));
        if(existing)existing.qty=qty;else items.push({id:product.id,title,image:safeImage(product.image),url:location.pathname+location.search,qty});
        localStorage.setItem(key,JSON.stringify(items));document.querySelector('[data-product-notice]').textContent=copy.added;
      });
      state.hidden=true;productView.hidden=false;
    }catch(error){state.querySelector('h1').textContent=error.message||copy.notFound;state.querySelector('a').textContent=copy.back;}
  }
  start();
})();
