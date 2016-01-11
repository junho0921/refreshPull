define(function(require, exports, module){

	var RefreshPull = module.exports = function($wrapper, config){
		this.initialize($wrapper, config);
	};

	RefreshPull.prototype = {

		initialize:function($wrapper, config){
			this._config = $.extend({}, this._defaultConfig, config);

			// 设css的兼容属性
			this._setCssProps();

			// 设定容器
			this._setTarget($wrapper, config);

			// 根据用户的设定来计算icon拖拽时的滚动速度等等
			this._calcRuns();

			// 生成icon
			this._buildIcon();

			// 绑定事件
			this._$container.on(this._begin_event, $.proxy(this._onTouchStart, this));
		},

		_defaultConfig : {
			triggerOffset:100,

			waiting: 3000,

			// icon滚出的最长距离
			loadingH: 200,
			// 收回icon的回滚次数
			dragRuns: 2,
			// 收回icon的回滚时间
			resetDuration: 1000,
			// icon内容
			renderer: function(){
				return $('<img src="./img/iconfont-loading.png">');
			},
			// 公开方法: 重新获取数据
			refreshData:null,
			// 公开方法: 加载更多数据
			loadMoreData:null,
			// 公开方法: 模板
			dataRenderer:null,
			// 选择向上拉向下拉的功能
			enablePullDown: false,
			enablePullUp: false
		},

		STATUS_TRIGGER_PULLDOWN:1,

		STATUS_TRIGGER_PULLUP:2,

		STATUS_TRIGGER_RESET:3,

		_begin_event:("ontouchstart" in document) ? "touchstart" : "mousedown",

		_move_event:("ontouchmove" in document) ? "touchmove" : "mousemove",

		_end_event:("ontouchend" in document) ? "touchend" : "mouseup",

		_status:null,

		_basicSetting: function($wrapper, config){
		// 这里_$wrapper = 家俊变量_$container // 这里_$container = 家俊变量_$content
		},

		_setTarget:function($wrapper, config){

			$wrapper.css({position: 'relative', overflow:'hidden'});

			this._wrapperH = $wrapper.outerHeight();

			if(this._config.containerSelector){
				this._$container = $wrapper.find(this._config.containerSelector);
			}else{
				this._$container = $wrapper.children().eq(0);
			}

			// 给内容添加一个外框作为scroll的容器
			this._$container.wrap('<div>');

			this._$wrapper = this._$container.parent()
				.css({
					"overflow-y":"auto",
					"-webkit-overflow-scrolling":"touch",
					height: this._wrapperH
				});
		},

		_calcRuns: function(){
			// icon滚一圈所用时间
			this._circleDuration = this._config.resetDuration / this._config.dragRuns;

			// icon每滚1deg所变化的高度
			this._dragDegPerY = (this._config.dragRuns * 360) / this._config.triggerOffset;

			// icon每滚1deg所过渡的时间
			this._resetDegPerTime = 360 / this._circleDuration;
		},

		_buildIcon: function(){
			var iconCss = {position: 'absolute', 'z-index':999, opacity:0};
			this._$wrapper
				.before(
				this._$topIconWrap = $('<div class="nu-refreshPull">')
					.css(iconCss)
					.append(
					this._$topIcon = this._config.renderer()
				)
			);

			if(this._config.enablePullUp) {
				this._$wrapper.after(
					this._$footIconWrap = $('<div class="nu-refreshPull">')
						.css(iconCss)
						.append(
						this._$footIcon = this._config.renderer()
					)
				);
			}
			this._iconH = this._$topIconWrap.height();
			//取得高度后设icon的位置
			this._$topIconWrap.css('top', -this._iconH + 'px');
			this._$footIconWrap.css({bottom: -this._iconH + 'px', top: 'auto'});
		},

		_onTouchStart:function(e){
			 console.log("_onTouchStart _status = ", this._status);
			if(this._status){return}
			// 超出阈值时的起始坐标
			this._beginY = 0;
			// 滑动时重新计算container高度
			this._containerH = this._$container.outerHeight();

			// 设icon的css过渡都为0
			if(this._config.enablePullDown) {
				this._setTransition(this._$topIconWrap, 0);
				this._setTransition(this._$topIcon, 0);
			}
			if(this._config.enablePullUp) {
				this._setTransition(this._$footIconWrap, 0);
				this._setTransition(this._$footIcon, 0);
			}

			// console.log("start");
			this._$container.on(this._move_event, $.proxy(this._onTouchMove, this));
			this._$container.on(this._end_event, $.proxy(this._onTouchEnd, this));
		},

		_onTouchMove:function(e){

			var scrollTop = this._$wrapper.scrollTop();

			if(scrollTop == 0 || scrollTop == this._containerH - this._wrapperH){
				if(!this._beginY){
					this._beginY = this._getY(e);
				}else{
					 e.preventDefault();
					
					var dragY = this._getY(e) - this._beginY;
					
					if(dragY > 0){
						
							this._direct = 1;//console.log('顶端拖拽');
						
						if(this._getY(e) - this._beginY > this._config.triggerOffset){
							this._status = this.STATUS_TRIGGER_PULLDOWN;
						}else{
							this._status = this.STATUS_TRIGGER_RESET;
						}

					}else

					if(dragY < 0){
						
						this._direct = 2;//console.log('底部拖拽');

						if(this._beginY - this._getY(e) > this._config.triggerOffset){
							this._status = this.STATUS_TRIGGER_PULLUP;
						}else{
							this._status = this.STATUS_TRIGGER_RESET;
						}
					} else {return}

					this._dragIcon(dragY);
				}
			}


		},

		_onTouchEnd:function(e){
			var _this = this;
			this._stopTime = e.timeStamp || (new Date()).getTime();

			console.warn("_onTouchEnd _status", this._status);
			this._$container.off(this._move_event);
			this._$container.off(this._end_event);

			if(this._status == this.STATUS_TRIGGER_PULLDOWN){
				this._setIconRun();
				setTimeout(function(){
					_this._refreshData();
				}, 2650)
			}else if(this._status == this.STATUS_TRIGGER_PULLUP){
				this._setIconRun();
				//this._loadMoreData();
			}else if(this._status == this.STATUS_TRIGGER_RESET){
				this._resetIcon({
					callback: function(){
						_this._status = null;
						_this._direct = null;
					}
				});
			}

		},

		_setIconRun: function(){
			var _this = this;
			var waitingRunDeg = this._config.waiting * this._resetDegPerTime;

			//this._iconDeg = this._iconDeg || 0;
			var runDeg = (this._iconDeg || 0) - waitingRunDeg;
			console.log(waitingRunDeg, this._iconDeg, this._config.waiting, runDeg);

			// css过渡旋转
			this._setTransition(this._$funcIcon, this._config.waiting);
			this._rotateIcon(runDeg, this._$funcIcon);

			this._timeFunc = setTimeout(function(){
				console.log('??_resetIcon');
				_this._resetIcon({
					callback: function(){
						_this._status = null;
						_this._direct = null;
					}
				})
			}, (this._config.waiting - this._config.resetDuration));
		},

		_resetIcon: function(options){
			clearTimeout(this._timeFunc);

			var _this = this;
			var resetduration, resetDeg;
			//duration = options && options.duration;

			if(this._status == this.STATUS_TRIGGER_RESET){
				resetduration = this._iconDeg / 360 * this._circleDuration;
				resetDeg = 0;


				// css过渡旋转
				this._setTransition(_this._$funcIcon, resetduration);
				this._rotateIcon(resetDeg, this._$funcIcon);
			} else {
				// 考虑正在滚动中的时间:
				var resetTimePot = (new Date()).getTime();
				var loadingDuration = (this._stopTime || resetTimePot) - resetTimePot;
				// 计算剩余过渡时间
				var remainDuration = this._config.waiting - loadingDuration;

				console.log('_resetIcon resetTimePot = ', resetTimePot,'    loadingDuration = ',  loadingDuration);

				resetduration = this._config.resetDuration;
				resetDeg = this._iconDeg - (this._config.dragRuns * 360);
				// waiting =3000, resetDuration=1000
				if(remainDuration < this._config.resetDuration){
					// 剩余过渡时间少于重置时间的话, 意味着回收icon到顶部也会停止旋转
					//this._setTransition(_this._$funcIcon, resetduration);
					//this._rotateIcon(resetDeg, this._$funcIcon);
				} else {
					// 剩余过渡时间不少于重置时间的话, 意味着现在回收icon到顶部也不会停止旋转, 不处理旋转
				}

			}

			//console.log('_resetIcon deg', this._iconDeg, resetDeg);
			//console.log('_resetIcon time', resetduration);

			//backwardsDuration = this._rotateDeg / this._resetDegPerTime;
			//
			//// 由于使用loadingAnimation, icon回滚旋转多了360度, 所以需要处理一下时间与次数
			//var iterationCount = this._rotateDeg / (this._rotateDeg + 360);


			// css过渡位移
			this._setTransition(_this._$funcIconWrap, resetduration);
			this._setIconPos(0, this._$funcIconWrap);

			setTimeout(function(){

				_this._rotateIcon(0, _this._$funcIcon);

				_this._renderFuncIcon(0);

				if(options && options.callback)options.callback();
			}, resetduration);
		},

		_getY:function(e){
			var e = e.originalEvent || e;
			return ("changedTouches" in e) ? e.changedTouches[0].pageY : e.pageY;
		},

		_refreshData:function(){
			this._config.refreshData($.proxy(this._refreshRender, this));
		},

		_loadMoreData:function(){
			this._config.loadMoreData($.proxy(this._loadMoreRender, this));
		},

		_refreshRender:function(datas){
			this._clearItems();
			this._appendItems(datas);
		},

		_loadMoreRender:function(datas){
			this._appendItems(datas);
		},

		_clearItems:function(){
			this._$container.empty();
			this._items = [];
		},

		_appendItem:function(data){
			var item = this._config.dataRenderer(data);
			this._items.push(item);
			item.appendTo(this._$container);
		},

		_appendItems:function(datas){
			for(var i = 0; i < datas.length; i++){
				this._appendItem(datas[i]);
			}
			this._refresh();
		},

		_refresh:function(){
			var _this = this;
			if(this._items.length == 0){
				this._$container.append(
					this._noDataTipEl = $(this.NO_DATA_HTML).css("height", this._$wrapper.outerHeight(true))
				)
			}else{
				// 顺利获取数据的状态
				if(this._noDataTipEl){
					this._noDataTipEl.hide();
				}
			}
			this._resetIcon({
				callback: function(){
					_this._status = null;
					_this._direct = null;
				}
			});
		},


		/**
		 * @desc 触发"下拉刷新"事件,一般用于首次加载数据
		 * @memberof Nuui.Scroll
		 * @func triggerRefresh
		 * @instance
		 */
		triggerRefresh:function(){
			this._renderFuncIcon(1);
			this._status = 'load';
			this._setIconRun();
			this._refreshData();
		},


		_renderFuncIcon: function(mode){
			// 选择当前操作的icon, mode = 1是选择顶部icon, 2是选择底部icon, 0是隐藏icon
			console.log('选择', mode)
			if(mode === 1){
				this._$funcIcon = this._$topIcon;
				this._$funcIconWrap = this._$topIconWrap.css('opacity', 1);
			} else if(mode === 2){
				this._$funcIcon = this._$footIcon;
				this._$funcIconWrap = this._$footIconWrap.css('opacity', 1);
			} else if(mode === 0){
				this._$topIconWrap.css('opacity', 0);
				this._$footIconWrap && this._$footIconWrap.css('opacity', 0);
				this._$funcIcon = null;
				this._$funcIconWrap = null;
			}
		},

		_dragIcon: function(dragY){
			if(this._direct === 2){
				dragY = -dragY;
			}
			//dragY = dragY * 0.75;

			this._renderFuncIcon(this._direct);

			this._rotateDeg = dragY * this._dragDegPerY;

			this._rotateIcon(this._rotateDeg, this._$funcIcon);

			this._setIconPos(dragY, this._$funcIconWrap);
		},

		_setIconPos: function(distance, $obj){
			// 初始化定位, 拖拽定位
			// 区别在于有没有_direct属性 // 因为_setIconPos运用的场景比较多, 所以对象$obj不能默认是this._$funcIconWrap
			distance = distance > this._config.triggerOffset ? this._config.triggerOffset : distance;

			var posProps = {};

			if(distance !== this._iconPosY){
				this._iconPosY = distance;//console.log(distance);

				if(this._direct === 2){distance = -distance}

				posProps[this._animType] = "translate3D(0, " + distance + "px, 0)";
				
				$obj.css(posProps);
			}
		},
		
		_rotateIcon: function(rotateDeg, $obj) {
			// 拖拽旋转icon
			var rotateProps = {};
			console.log('_rotateIcon', rotateDeg);
			this._iconDeg = rotateDeg;

			rotateProps[this._animType] = "rotateZ(" + rotateDeg + "deg)";
			$obj.css(rotateProps);
		},
		
		_setTransition: function($obj, duration) {
			var transition = {};
			
			transition[this._transitionType] = this._transformType + ' ' + duration + 'ms linear';
			
			$obj.css(transition);
		},
		
		_setCssProps: function() {
			// 环境检测可用的css属性: 能否使用transition, 能否使用transform
			var bodyStyle = document.body.style;

			if (bodyStyle.WebkitTransition !== undefined ||
				bodyStyle.MozTransition !== undefined ||
				bodyStyle.msTransition !== undefined) {
				//if (this._staticConfig._useCSS === true) { //_config是提供用户的选择, 但要使用的话, 需检测环境能否
				this._cssTransitions = true;
				//}
			}
			/*setProps的主要作用之一:检测可使用的前缀, 可以用来借鉴, Perspective更小众*/
			if (bodyStyle.OTransform !== undefined) {
				this._animType = 'OTransform';
				this._transformType = '-o-transform';
				this._transitionType = 'OTransition';
				this._animationType = '-o-animation';
				if (bodyStyle.perspectiveProperty === undefined && bodyStyle.webkitPerspective === undefined) this._animType = false;
			}
			if (bodyStyle.MozTransform !== undefined) {
				this._animType = 'MozTransform';
				this._transformType = '-moz-transform';
				this._transitionType = 'MozTransition';
				this._animationType = '-moz-animation';
				if (bodyStyle.perspectiveProperty === undefined && bodyStyle.MozPerspective === undefined) this._animType = false;
			}
			if (bodyStyle.webkitTransform !== undefined) {
				this._animType = 'webkitTransform';
				this._transformType = '-webkit-transform';
				this._transitionType = 'webkitTransition';
				this._animationType = '-webkit-animation';
				if (bodyStyle.perspectiveProperty === undefined && bodyStyle.webkitPerspective === undefined) this._animType = false;
			}
			if (bodyStyle.msTransform !== undefined) {
				this._animType = 'msTransform';
				this._transformType = '-ms-transform';
				this._transitionType = 'msTransition';
				this._animationType = '-ms-animation';
				if (bodyStyle.msTransform === undefined) this._animType = false;
			}
			if (bodyStyle.transform !== undefined && this._animType !== false) {
				this._animType = 'transform';
				this._transformType = 'transform';
				this._transitionType = 'transition';
				this._animationType = 'animation';
			}
			this._transformsEnabled =
				//this._staticConfig._useTransform &&
				(this._animType !== null && this._animType !== false);
			//this._transformsEnabled = false;// 测试用
			//this._cssTransitions = false;// 测试用
		},


		nextFrame : function() {
			return window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				window.oRequestAnimationFrame ||
				window.msRequestAnimationFrame ||
				function(callback) { return setTimeout(callback, 1); };
		},

	}
});
